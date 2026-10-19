
pipeline {
    agent any

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(
            numToKeepStr: '15',
            artifactNumToKeepStr: '5'
        ))
        disableConcurrentBuilds()
        skipDefaultCheckout()
    }

    parameters {
        choice(
            name: 'ENVIRONMENT',
            choices: ['development', 'staging', 'production'],
            description: 'Target environment'
        )

        string(
            name: 'REGISTRY',
            defaultValue: 'docker.io',
            description: 'Container registry hostname'
        )

        string(
            name: 'IMAGE_NAME',
            defaultValue: 'corsal2006/smartstock',
            description: 'Docker Hub namespace/image; change if needed'
        )

        booleanParam(
            name: 'PUBLISH_IMAGE',
            defaultValue: false,
            description: 'Push the image to the container registry'
        )

        booleanParam(
            name: 'DEPLOY_LOCAL',
            defaultValue: false,
            description: 'Deploy a separate local container on port 8081'
        )

        booleanParam(
            name: 'RUN_TRIVY',
            defaultValue: false,
            description: 'Run a Trivy image security scan if available'
        )
    }

    environment {
        APP_NAME          = 'smartstock-ai'
        CONTAINER_NAME    = 'smartstock-jenkins-deploy'
        REGISTRY_CREDS_ID = 'docker-registry-credentials'
        JIRA_CREDS_ID     = 'jira-api-credentials'
        JIRA_BASE_URL     = 'https://siddeshnaik292006.atlassian.net'
        JIRA_PROJECT_KEY  = 'SMAR'
        DEPLOY_PORT       = '8081'
    }

    stages {
        stage('Checkout SCM') {
            steps {
                checkout scm

                script {
                    env.GIT_SHORT_COMMIT = sh(
                        script: 'git rev-parse --short HEAD',
                        returnStdout: true
                    ).trim()

                    env.IMAGE_TAG =
                        "${params.ENVIRONMENT}-${env.BUILD_NUMBER}-${env.GIT_SHORT_COMMIT}"

                    env.FULL_IMAGE_NAME =
                        "${params.REGISTRY}/${params.IMAGE_NAME}"

                    def commitMessage = sh(
                        script: 'git log -1 --pretty=%B',
                        returnStdout: true
                    ).trim()

                    def branchName = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    def issueMatcher =
                        (branchName + ' ' + commitMessage) =~ /(SMAR-\d+)/

                    if (issueMatcher.find()) {
                        env.JIRA_ISSUE_KEY = issueMatcher.group(1)
                        echo "Jira issue detected: ${env.JIRA_ISSUE_KEY}"
                    } else {
                        env.JIRA_ISSUE_KEY = ''
                        echo 'No SMAR issue key found in branch or commit message.'
                    }

                    echo "Commit: ${env.GIT_SHORT_COMMIT}"
                    echo "Image tag: ${env.IMAGE_TAG}"
                }
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -eu

                    test -f index.html
                    test -f package.json
                    test -f Dockerfile
                    test -f nginx.conf
                    test -f Jenkinsfile

                    echo "Required SmartStock files are present."
                '''
            }
        }

        stage('Check Build Tools') {
            steps {
                sh '''
                    set -eu

                    node --version
                    npm --version
                    docker --version
                    docker info >/dev/null

                    echo "Node.js and Docker are available."
                '''
            }
        }

        stage('Lint and Unit Tests') {
            steps {
                sh '''
                    set -eu

                    npm run lint
                    npm test

                    echo "Linting and unit tests passed."
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                sh '''
                    set -eu

                    docker build \
                      --file Dockerfile \
                      --tag "$FULL_IMAGE_NAME:$IMAGE_TAG" \
                      --tag "$FULL_IMAGE_NAME:$ENVIRONMENT-latest" \
                      .

                    echo "Docker image built successfully."
                '''
            }
        }

        stage('Security Scan') {
            when {
                expression { params.RUN_TRIVY }
            }

            steps {
                sh '''
                    set -eu

                    if command -v trivy >/dev/null 2>&1; then
                        trivy image \
                          --severity HIGH,CRITICAL \
                          --exit-code 1 \
                          "$FULL_IMAGE_NAME:$IMAGE_TAG"
                    else
                        echo "Trivy is not installed on this Jenkins agent."
                        echo "Install Trivy or disable RUN_TRIVY."
                        exit 1
                    fi
                '''
            }
        }

        stage('Publish Docker Image') {
            when {
                expression { params.PUBLISH_IMAGE }
            }

            steps {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'docker-registry-credentials',
                        usernameVariable: 'REGISTRY_USER',
                        passwordVariable: 'REGISTRY_PASSWORD'
                    )
                ]) {
                    sh '''
                        set -eu

                        echo "$REGISTRY_PASSWORD" |
                          docker login "$REGISTRY" \
                            --username "$REGISTRY_USER" \
                            --password-stdin

                        docker push "$FULL_IMAGE_NAME:$IMAGE_TAG"
                        docker push "$FULL_IMAGE_NAME:$ENVIRONMENT-latest"

                        docker logout "$REGISTRY"
                    '''
                }
            }
        }

        stage('Deploy Separate Local Container') {
            when {
                expression { params.DEPLOY_LOCAL }
            }

            steps {
                sh '''
                    set -eu

                    # This uses a dedicated container name and port.
                    # It does not replace the existing SmartStock container.

                    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

                    docker run -d \
                      --name "$CONTAINER_NAME" \
                      --restart unless-stopped \
                      -p "${DEPLOY_PORT}:8080" \
                      -e APP_ENV="$ENVIRONMENT" \
                      "$FULL_IMAGE_NAME:$IMAGE_TAG"
                '''
            }
        }

        stage('Verify Local Deployment') {
            when {
                expression { params.DEPLOY_LOCAL }
            }

            steps {
                script {
                    def healthy = false

                    for (int attempt = 1; attempt <= 10; attempt++) {
                        sleep(time: 2, unit: 'SECONDS')

                        def status = sh(
                            script: """
                                curl -sS -o /dev/null \
                                  -w '%{http_code}' \
                                  http://localhost:${env.DEPLOY_PORT}/healthz \
                                  || true
                            """,
                            returnStdout: true
                        ).trim()

                        if (status == '200') {
                            healthy = true
                            echo 'SmartStock health check passed.'
                            break
                        }

                        echo "Health check attempt ${attempt}: HTTP ${status}"
                    }

                    if (!healthy) {
                        sh 'docker logs --tail 50 "$CONTAINER_NAME" || true'
                        error('Deployment health check failed.')
                    }
                }
            }
        }

        stage('Jira Build Notification') {
            when {
                expression {
                    return env.JIRA_ISSUE_KEY &&
                           env.JIRA_ISSUE_KEY.trim() != ''
                }
            }

            steps {
                echo """
                    Jira issue: ${env.JIRA_ISSUE_KEY}
                    Jenkins build: ${env.BUILD_NUMBER}
                    Result: pipeline reached Jira notification stage
                """

                echo 'Jira/GitHub development linking remains enabled.'
                echo 'Direct Jira REST updates can be added after credentials are configured.'
            }
        }
    }

    post {
        success {
            echo 'SmartStock Jenkins pipeline completed successfully.'
        }

        failure {
            echo 'SmartStock Jenkins pipeline failed. Review Console Output.'
        }

        always {
            echo "Build #${env.BUILD_NUMBER} finished: ${currentBuild.currentResult}"
        }
    }
}
