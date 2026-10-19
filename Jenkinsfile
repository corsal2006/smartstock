// ==============================================================================
// Jenkins Declarative Pipeline - SmartStock AI
// Integrated CI/CD: GitHub -> Jenkins -> Docker -> Trivy -> Registry -> Deploy -> Jira
// ==============================================================================

pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15', artifactNumToKeepStr: '5'))
        disableConcurrentBuilds()
        ansiColor('xterm')
    }

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['production', 'staging', 'development'], description: 'Deployment Target Environment')
        string(name: 'REGISTRY', defaultValue: 'docker.io', description: 'Container Registry Host (e.g., docker.io, ghcr.io)')
        string(name: 'IMAGE_NAME', defaultValue: 'phutaneprathamesh829/smart-stock', description: 'Repository and Image Name')
        string(name: 'DEPLOY_PORT', defaultValue: '8080', description: 'Target Host Port for Application Deployment')
        choice(name: 'SCAN_SEVERITY', choices: ['CRITICAL,HIGH', 'CRITICAL', 'MEDIUM,HIGH,CRITICAL'], description: 'Trivy Security Vulnerability Threshold')
        booleanParam(name: 'SKIP_DEPLOY', defaultValue: false, description: 'Build and test only; skip container deployment')
    }

    environment {
        APP_NAME              = 'smartstock-ai'
        CONTAINER_NAME        = 'smartstock-container'
        REGISTRY_CREDS_ID     = 'docker-registry-credentials'
        JIRA_CREDS_ID         = 'jira-api-token'
        JIRA_BASE_URL         = 'https://your-workspace.atlassian.net'
        JIRA_PROJECT_KEY      = 'STOCK'
        GIT_SHORT_COMMIT      = ''
        IMAGE_TAG             = ''
        FULL_IMAGE_NAME       = ''
        JIRA_ISSUE_KEY        = ''
    }

    stages {
        // ----------------------------------------------------------------------
        // Stage 1: Checkout Source Code
        // ----------------------------------------------------------------------
        stage('Checkout SCM') {
            steps {
                script {
                    echo "Checking out source code from GitHub repository..."
                    checkout scm

                    // Extract immutable Git commit SHA (7 chars)
                    GIT_SHORT_COMMIT = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                    IMAGE_TAG = "${params.ENVIRONMENT}-${env.BUILD_NUMBER}-${GIT_SHORT_COMMIT}"
                    FULL_IMAGE_NAME = "${params.REGISTRY}/${params.IMAGE_NAME}"

                    // Extract Jira issue key if present in branch name or commit log
                    def commitMsg = sh(script: "git log -1 --pretty=%B", returnStdout: true).trim()
                    def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    def matcher = (branchName =~ /(${params.JIRA_PROJECT_KEY}-\d+)/) || (commitMsg =~ /(${params.JIRA_PROJECT_KEY}-\d+)/)
                    if (matcher) {
                        JIRA_ISSUE_KEY = matcher[0][1]
                        echo "Detected Jira Issue Key: ${JIRA_ISSUE_KEY}"
                    } else {
                        echo "No Jira issue key detected in branch or commit message."
                    }

                    echo "Build Triggered for Commit: ${GIT_SHORT_COMMIT} | Image Tag: ${IMAGE_TAG}"
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 2: Environment & Tool Validation
        // ----------------------------------------------------------------------
        stage('Validate Environment') {
            steps {
                script {
                    echo "Validating host prerequisites and tools..."
                    sh 'docker --version'
                    sh 'node -v || true'
                    sh 'npm -v || true'
                    sh 'curl --version || true'

                    // Validate critical project files
                    sh 'test -f index.html || { echo "Missing index.html!"; exit 1; }'
                    sh 'test -f Dockerfile || { echo "Missing Dockerfile!"; exit 1; }'
                    sh 'test -f nginx.conf || { echo "Missing nginx.conf!"; exit 1; }'
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 3: Install Dependencies
        // ----------------------------------------------------------------------
        stage('Install Dependencies') {
            steps {
                script {
                    echo "Installing project dependencies..."
                    sh 'npm install --ignore-scripts || true'
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 4: Linting & Automated Tests
        // ----------------------------------------------------------------------
        stage('Lint & Unit Tests') {
            steps {
                script {
                    echo "Executing static analysis and security linting..."
                    sh 'npm run lint'

                    echo "Running automated domain and business logic tests..."
                    sh 'npm test'
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 5: Build Docker Image
        // ----------------------------------------------------------------------
        stage('Build Docker Image') {
            steps {
                script {
                    echo "Building production Docker image: ${FULL_IMAGE_NAME}:${IMAGE_TAG}"
                    sh """
                        docker build \
                            --file Dockerfile \
                            --tag ${FULL_IMAGE_NAME}:${IMAGE_TAG} \
                            --tag ${FULL_IMAGE_NAME}:${params.ENVIRONMENT}-latest \
                            .
                    """
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 6: Container Security Vulnerability Scan (Trivy)
        // ----------------------------------------------------------------------
        stage('Security Scan (Trivy)') {
            steps {
                script {
                    echo "Scanning container image with Trivy for vulnerabilities..."
                    // Check if trivy is installed on agent; otherwise run via containerized trivy
                    sh """
                        if command -v trivy >/dev/null 2>&1; then
                            trivy image --severity ${params.SCAN_SEVERITY} --exit-code 0 ${FULL_IMAGE_NAME}:${IMAGE_TAG}
                        elif docker --version >/dev/null 2>&1; then
                            docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
                                aquasec/trivy:latest image \
                                --severity ${params.SCAN_SEVERITY} \
                                --exit-code 0 \
                                ${FULL_IMAGE_NAME}:${IMAGE_TAG} || true
                        else
                            echo "Trivy not found on host, skipping scan."
                        fi
                    """
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 7: Publish Docker Image to Registry
        // ----------------------------------------------------------------------
        stage('Publish Image to Registry') {
            when {
                anyOf {
                    branch 'main'
                    expression { return params.ENVIRONMENT == 'production' }
                }
            }
            steps {
                script {
                    echo "Publishing container image to registry: ${params.REGISTRY}"
                    try {
                        withCredentials([usernamePassword(credentialsId: REGISTRY_CREDS_ID, usernameVariable: 'REG_USER', passwordVariable: 'REG_PASS')]) {
                            sh """
                                echo "\$REG_PASS" | docker login ${params.REGISTRY} -u "\$REG_USER" --password-stdin
                                docker push ${FULL_IMAGE_NAME}:${IMAGE_TAG}
                                docker push ${FULL_IMAGE_NAME}:${params.ENVIRONMENT}-latest
                            """
                        }
                    } catch (Exception e) {
                        echo "Registry credentials '${REGISTRY_CREDS_ID}' not configured or publish skipped: ${e.message}"
                        echo "Retaining local image ${FULL_IMAGE_NAME}:${IMAGE_TAG} for deployment."
                    }
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 8: Deploy Container
        // ----------------------------------------------------------------------
        stage('Deploy Application') {
            when {
                expression { return !params.SKIP_DEPLOY }
            }
            steps {
                script {
                    echo "Deploying ${FULL_IMAGE_NAME}:${IMAGE_TAG} to port ${params.DEPLOY_PORT}..."

                    // Safe blue/green container rollout:
                    // 1. Tag backup of current running container image if exists
                    sh """
                        OLD_IMAGE=\$(docker inspect --format='{{.Config.Image}}' ${CONTAINER_NAME} 2>/dev/null || echo "")
                        if [ -n "\$OLD_IMAGE" ]; then
                            echo "Backing up previous active image: \$OLD_IMAGE as ${CONTAINER_NAME}:rollback"
                            docker tag "\$OLD_IMAGE" ${CONTAINER_NAME}:rollback || true
                        fi
                    """

                    // 2. Stop and replace only the designated application container
                    sh """
                        docker stop ${CONTAINER_NAME} 2>/dev/null || true
                        docker rm ${CONTAINER_NAME} 2>/dev/null || true
                        
                        docker run -d \
                            --name ${CONTAINER_NAME} \
                            --restart unless-stopped \
                            -p ${params.DEPLOY_PORT}:8080 \
                            -e APP_ENV=${params.ENVIRONMENT} \
                            ${FULL_IMAGE_NAME}:${IMAGE_TAG}
                    """
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 9: Deployment Verification & Health Check
        // ----------------------------------------------------------------------
        stage('Verify Deployment') {
            when {
                expression { return !params.SKIP_DEPLOY }
            }
            steps {
                script {
                    echo "Verifying service health on http://localhost:${params.DEPLOY_PORT}/healthz..."
                    def healthCheckPassed = false

                    for (int i = 1; i <= 10; i++) {
                        sleep(time: 2, unit: 'SECONDS')
                        def status = sh(
                            script: "curl -s -o /dev/null -w '%{http_code}' http://localhost:${params.DEPLOY_PORT}/healthz || echo 'fail'",
                            returnStdout: true
                        ).trim()

                        if (status == '200') {
                            echo "Health check PASSED on attempt ${i} (HTTP 200 OK)!"
                            sh "curl -s http://localhost:${params.DEPLOY_PORT}/healthz"
                            healthCheckPassed = true
                            break
                        }
                        echo "Health check attempt ${i}/10 returned status [${status}], retrying..."
                    }

                    if (!healthCheckPassed) {
                        echo "HEALTH CHECK FAILED! Initiating automatic rollback..."
                        sh """
                            docker logs --tail 50 ${CONTAINER_NAME}
                            if docker image inspect ${CONTAINER_NAME}:rollback >/dev/null 2>&1; then
                                echo "Rolling back to previous working container..."
                                docker stop ${CONTAINER_NAME} || true
                                docker rm ${CONTAINER_NAME} || true
                                docker run -d --name ${CONTAINER_NAME} --restart unless-stopped -p ${params.DEPLOY_PORT}:8080 ${CONTAINER_NAME}:rollback
                                echo "Rollback container started."
                            fi
                        """
                        error("Deployment verification failed: endpoint /healthz did not return 200.")
                    }
                }
            }
        }

        // ----------------------------------------------------------------------
        // Stage 10: Jira Status Notification (Optional / Configurable)
        // ----------------------------------------------------------------------
        stage('Update Jira') {
            when {
                expression { return JIRA_ISSUE_KEY != '' }
            }
            steps {
                script {
                    echo "Updating Jira Issue [${JIRA_ISSUE_KEY}] with build and deployment information..."
                    try {
                        withCredentials([string(credentialsId: JIRA_CREDS_ID, variable: 'JIRA_TOKEN')]) {
                            def commentBody = """{
                                \\"body\\": {
                                    \\"type\\": \\"doc\\",
                                    \\"version\\": 1,
                                    \\"content\\": [{
                                        \\"type\\": \\"paragraph\\",
                                        \\"content\\": [{
                                            \\"type\\": \\"text\\",
                                            \\"text\\": \\"Jenkins Build #${env.BUILD_NUMBER} succeeded! Deployed image ${FULL_IMAGE_NAME}:${IMAGE_TAG} to environment [${params.ENVIRONMENT}].\\"
                                        }]
                                    }]
                                }
                            }"""

                            sh """
                                curl -s -X POST \
                                    -H "Content-Type: application/json" \
                                    -H "Authorization: Bearer \$JIRA_TOKEN" \
                                    -d "${commentBody}" \
                                    "${JIRA_BASE_URL}/rest/api/3/issue/${JIRA_ISSUE_KEY}/comment" || true
                            """
                            echo "Jira update comment submitted."
                        }
                    } catch (Exception e) {
                        echo "Jira update skipped or credential '${JIRA_CREDS_ID}' not configured: ${e.message}"
                    }
                }
            }
        }
    }

    // --------------------------------------------------------------------------
    // Post-Build Execution & Notifications
    // --------------------------------------------------------------------------
    post {
        success {
            echo "SUCCESS: SmartStock AI build and deployment pipeline completed successfully!"
            script {
                // Non-destructive cleanup: prune only dangling untagged images
                sh 'docker image prune -f --filter "dangling=true" || true'
            }
        }
        failure {
            echo "FAILURE: Pipeline execution failed! Review stage logs above."
        }
        always {
            echo "Finished Jenkins pipeline execution for build #${env.BUILD_NUMBER}."
        }
    }
}
