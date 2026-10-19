
pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

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
            description: 'Publish the image to Docker Hub'
        )

        booleanParam(
            name: 'DEPLOY_LOCAL',
            defaultValue: false,
            description: 'Deploy a separate test container on port 8081'
        )

        booleanParam(
            name: 'RUN_TRIVY',
            defaultValue: false,
            description: 'Run a Trivy vulnerability scan'
        )
    }

    environment {
        REGISTRY_CREDS_ID = 'docker-registry-credentials'
        JIRA_BASE_URL     = 'https://siddeshnaik292006.atlassian.net'
        JIRA_PROJECT_KEY  = 'SMAR'
        CONTAINER_NAME    = 'smartstock-jenkins-test'
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

                    def branchName =
                        env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''

                    def matcher =
                        (branchName + ' ' + commitMessage) =~ /(SMAR-\d+)/

                    env.JIRA_ISSUE_KEY = ''

                    if (matcher.find()) {
                        env.JIRA_ISSUE_KEY = matcher.group(1)
                        echo "Detected Jira issue: ${env.JIRA_ISSUE_KEY}"
                    } else {
                        echo 'No SMAR issue key detected.'
                    }

                    echo "Commit: ${env.GIT_SHORT_COMMIT}"
                    echo "Image: ${env.FULL_IMAGE_NAME}:${env.IMAGE_TAG}"
                }
            }
        }

        stage('Validate Project') {
            steps {
                sh '''
                    set -eu

                    test -f package.json
                    test -f index.html
                    test -f Dockerfile
                    test -f nginx.conf
                    test -f Jenkinsfile

                    echo "Required project files are present."
                '''
            }
        }

        stage('Check Build Tools') {
            steps {
                sh '''
                    set -eu

                    echo "Checking Node.js..."
                    node --version
                    npm --version

                    echo "Checking Git..."
                    git --version

                    echo "Checking Docker..."
                    docker --version
                    docker info >/dev/null

                    echo "Build tools are available."
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -eu

                    if [ -f package-lock.json ]; then
                        npm ci
                    else
                        echo "No package-lock.json found; using npm install."
                        npm install
                    fi
                '''
            }
        }

        stage('Lint and Unit Tests') {
            steps {
                sh '''
                    set -eu

                    npm run lint
                    npm test

                    echo "Lint and unit tests passed."
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

                    if ! command -v trivy >/dev/null 2>&1; then
                        echo "Trivy is not installed on this Jenkins agent."
                        exit 1
                    fi

                    trivy image \
                      --severity HIGH,CRITICAL \
                      --exit-code 1 \
                      "$FULL_IMAGE_NAME:$IMAGE_TAG"
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
                    '''
                }
            }

            post {
                always {
                    sh '''
                        docker logout "$REGISTRY" >/dev/null 2>&1 || true
                    '''
                }
            }
        }

        stage('Deploy Separate Test Container') {
            when {
                expression { params.DEPLOY_LOCAL }
            }

            steps {
                sh '''
                    set -eu

                    # This uses a dedicated container and port.
                    # It does not replace the existing SmartStock container.

                    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true

                    docker run -d \
                      --name "$CONTAINER_NAME" \
                      --restart unless-stopped \
                      -p "${DEPLOY_PORT}:80" \
                      -e APP_ENV="$ENVIRONMENT" \
                      "$FULL_IMAGE_NAME:$IMAGE_TAG"
                '''
            }
        }

        stage('Verify Test Deployment') {
            when {
                expression { params.DEPLOY_LOCAL }
            }

            steps {
                script {
                    def healthy = false

                    for (int attempt = 1; attempt <= 10; attempt++) {
                        sleep(time: 2, unit: 'SECONDS')

                        def status = sh(
                            script: '''
                                curl -sS -o /dev/null \
                                  -w '%{http_code}' \
                                  http://localhost:8081/ || true
                            ''',
                            returnStdout: true
                        ).trim()

                        if (status == '200') {
                            healthy = true
                            echo 'Test deployment returned HTTP 200.'
                            break
                        }

                        echo "Health check attempt ${attempt}: HTTP ${status}"
                    }

                    if (!healthy) {
                        sh '''
                            docker logs --tail 50 "$CONTAINER_NAME" || true
                        '''

                        error('Test deployment verification failed.')
                    }
                }
            }
        }

        stage('Jira Build Information') {
            steps {
                script {
                    echo "Jenkins build: #${env.BUILD_NUMBER}"
                    echo "Git commit: ${env.GIT_SHORT_COMMIT}"
                    echo "Image tag: ${env.IMAGE_TAG}"
                    echo "Jira project: ${env.JIRA_PROJECT_KEY}"

                    if (env.JIRA_ISSUE_KEY != null &&
                        !env.JIRA_ISSUE_KEY.trim().isEmpty()) {
                        echo "Related Jira issue: ${env.JIRA_ISSUE_KEY}"
                    } else {
                        echo 'No related Jira issue detected.'
                    }

                    echo 'Jira development linking is handled by the GitHub integration.'
                    echo 'This stage does not send a Jira REST API request.'
                }
            }
        }
    }

    post {
        success {
            echo 'SUCCESS: SmartStock Jenkins pipeline completed.'
        }

        failure {
            echo 'FAILURE: Check Console Output for the failed stage.'
        }

        always {
            echo "Build #${env.BUILD_NUMBER}: ${currentBuild.currentResult}"
        }
    }
}
