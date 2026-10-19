
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
            description: 'Target deployment environment'
        )

        string(
            name: 'REGISTRY',
            defaultValue: 'docker.io',
            description: 'Container registry hostname'
        )

        string(
            name: 'IMAGE_NAME',
            defaultValue: 'corsal2006/smartstock',
            description: 'Docker image repository'
        )

        booleanParam(
            name: 'PUBLISH_IMAGE',
            defaultValue: false,
            description: 'Push the image to Docker Hub'
        )

        booleanParam(
            name: 'DEPLOY_LOCAL',
            defaultValue: false,
            description: 'Deploy a separate test container on port 8081'
        )

        booleanParam(
            name: 'RUN_TRIVY',
            defaultValue: false,
            description: 'Run a Trivy image vulnerability scan'
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
                        echo 'No SMAR issue key found in branch or commit.'
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

                    echo "Project files validated."
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

                    echo "Required tools are available."
                '''
            }
        }

        stage('Install Dependencies') {
            steps {
                sh '''
                    set -eu
                    npm ci
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
                        echo "Trivy is not installed on the Jenkins agent."
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

                        docker logout "$REGISTRY"
                    '''
                }
            }

            post {
                always {
                    sh 'docker logout "$REGISTRY" >/dev/null 2>&1 || true'
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

                    # Use a dedicated container and port.
                    # Do not replace the existing SmartStock container.

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

                        echo "Attempt ${attempt}: HTTP ${status}"
                    }

                    if (!healthy) {
                        sh '''
                            docker logs --tail 50 "$CONTAINER_NAME" || true
                        '''
                        error('Test deployment health check failed.')
                    }
                }
            }
        }

        stage('Jira Build Information') {
            steps {
                echo "Jenkins build: #${env.BUILD_NUMBER}"
                echo "Git commit: ${env.GIT_SHORT_COMMIT}"
                echo "Image tag: ${env.IMAGE_TAG}"
                echo "Jira project key: ${env.JIRA_PROJECT_KEY}"

                if (env.JIRA_ISSUE_KEY) {
                    echo "Related Jira issue: ${env.JIRA_ISSUE_KEY}"
                }

                echo 'Jira issue updates are not sent by this stage.'
                echo 'GitHub/Jira development linking remains separate.'
            }
        }
    }

    post {
        success {
            echo 'SUCCESS: SmartStock Jenkins pipeline completed.'
        }

        failure {
            echo 'FAILURE: Check Console Output for the failing stage.'
        }

        always {
            echo "Build #${env.BUILD_NUMBER}: ${currentBuild.currentResult}"
        }
    }
}
