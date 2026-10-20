pipeline {
    agent any

    tools {
        nodejs 'NodeJS-22'
    }

    options {
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '15', artifactNumToKeepStr: '5'))
        disableConcurrentBuilds()
        skipDefaultCheckout()
    }

    parameters {
        choice(name: 'ENVIRONMENT', choices: ['development', 'staging', 'production'],
               description: 'Environment for non-production branches; main/master deploy as production')
        string(name: 'REGISTRY', defaultValue: 'docker.io', description: 'Container registry hostname')
        string(name: 'IMAGE_NAME', defaultValue: 'sidd2294/smartstock', description: 'Docker Hub namespace/image')
        booleanParam(name: 'PUBLISH_IMAGE', defaultValue: true, description: 'Publish the image to Docker Hub')
        booleanParam(name: 'DEPLOY_LOCAL', defaultValue: true, description: 'Deploy and verify a separate test container on port 8081')
        booleanParam(name: 'DEPLOY_PRODUCTION', defaultValue: true, description: 'Allow automatic production deployment on main/master after test verification')
        booleanParam(name: 'RUN_TRIVY', defaultValue: false, description: 'Run Trivy security scanning; requires Trivy installed')
    }

    environment {
        REGISTRY_CREDS_ID = 'docker-registry-credentials'
        JIRA_BASE_URL = 'https://siddeshnaik292006.atlassian.net'
        JIRA_PROJECT_KEY = 'SMAR'
        CONTAINER_NAME = 'smartstock-jenkins-test'
        DEPLOY_PORT = '8081'
    }

    stages {
        stage('Checkout SCM') {
            steps {
                checkout scm
                script {
                    env.GIT_SHORT_COMMIT = sh(script: 'git rev-parse --short HEAD', returnStdout: true).trim()
                    def rawBranch = env.BRANCH_NAME ?: env.GIT_BRANCH ?: ''
                    env.SOURCE_BRANCH = rawBranch.replaceFirst(/^refs\/heads\//, '').replaceFirst(/^origin\//, '')
                    env.BUILD_ENVIRONMENT = (env.SOURCE_BRANCH == 'main' || env.SOURCE_BRANCH == 'master') ? 'production' : params.ENVIRONMENT
                    env.IMAGE_TAG = "${env.BUILD_ENVIRONMENT}-${env.BUILD_NUMBER}-${env.GIT_SHORT_COMMIT}"
                    env.FULL_IMAGE_NAME = "${params.REGISTRY}/${params.IMAGE_NAME}"

                    def commitMessage = sh(script: 'git log -1 --pretty=%B', returnStdout: true).trim()
                    def matcher = (env.SOURCE_BRANCH + ' ' + commitMessage) =~ /(SMAR-\d+)/
                    env.JIRA_ISSUE_KEY = ''
                    if (matcher.find()) {
                        env.JIRA_ISSUE_KEY = matcher.group(1)
                        echo "Detected Jira issue: ${env.JIRA_ISSUE_KEY}"
                    } else {
                        echo 'No SMAR issue key detected.'
                    }
                    echo "Branch: ${env.SOURCE_BRANCH}"
                    echo "Commit: ${env.GIT_SHORT_COMMIT}"
                    echo "Build environment: ${env.BUILD_ENVIRONMENT}"
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
                    node --version
                    npm --version
                    git --version
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
                    docker build --file Dockerfile \
                      --tag "$FULL_IMAGE_NAME:$IMAGE_TAG" \
                      --tag "$FULL_IMAGE_NAME:$BUILD_ENVIRONMENT-latest" .
                    echo "Docker image built successfully."
                '''
            }
        }

        stage('Security Scan') {
            when { expression { params.RUN_TRIVY } }
            steps {
                sh '''
                    set -eu
                    if ! command -v trivy >/dev/null 2>&1; then
                        echo "Trivy is not installed on this Jenkins agent."
                        exit 1
                    fi
                    trivy image --severity HIGH,CRITICAL --exit-code 1 "$FULL_IMAGE_NAME:$IMAGE_TAG"
                '''
            }
        }

        stage('Publish Docker Image') {
            when { expression { params.PUBLISH_IMAGE } }
            steps {
                withCredentials([usernamePassword(credentialsId: 'docker-registry-credentials',
                    usernameVariable: 'REGISTRY_USER', passwordVariable: 'REGISTRY_PASSWORD')]) {
                    sh '''
                        set -eu
                        echo "$REGISTRY_PASSWORD" | docker login "$REGISTRY" --username "$REGISTRY_USER" --password-stdin
                        docker push "$FULL_IMAGE_NAME:$IMAGE_TAG"
                        docker push "$FULL_IMAGE_NAME:$BUILD_ENVIRONMENT-latest"
                        echo "Docker image published successfully."
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
            when { expression { params.DEPLOY_LOCAL } }
            steps {
                sh '''
                    set -eu
                    docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
                    docker run -d --name "$CONTAINER_NAME" --restart unless-stopped \
                      -p "${DEPLOY_PORT}:80" -e APP_ENV="$BUILD_ENVIRONMENT" "$FULL_IMAGE_NAME:$IMAGE_TAG"
                    echo "Test container started."
                    docker ps --filter "name=$CONTAINER_NAME"
                '''
            }
        }

        stage('Verify Test Deployment') {
            when { expression { params.DEPLOY_LOCAL } }
            steps {
                script {
                    def healthy = false
                    for (int attempt = 1; attempt <= 10; attempt++) {
                        sleep(time: 2, unit: 'SECONDS')
                        def running = sh(script: '''
                            docker inspect --format '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true
                        ''', returnStdout: true).trim()
                        if (running == 'true') {
                            def status = sh(script: '''
                                docker exec "$CONTAINER_NAME" wget -q -O /dev/null http://127.0.0.1/ >/dev/null 2>&1 && echo 200 || echo 000
                            ''', returnStdout: true).trim()
                            echo "Health check attempt ${attempt}: HTTP ${status}"
                            if (status == '200') {
                                healthy = true
                                echo 'Test deployment verified successfully.'
                                break
                            }
                        } else {
                            echo "Test container is not running (attempt ${attempt})."
                        }
                    }
                    if (!healthy) {
                        sh '''
                            echo "Container status:"
                            docker ps -a --filter "name=$CONTAINER_NAME"
                            echo "Container logs:"
                            docker logs --tail 50 "$CONTAINER_NAME" || true
                        '''
                        error('Test deployment verification failed.')
                    }
                }
            }
        }

        stage('Deploy Production') {
            when {
                expression {
                    params.DEPLOY_PRODUCTION && params.DEPLOY_LOCAL &&
                    (env.SOURCE_BRANCH == 'main' || env.SOURCE_BRANCH == 'master')
                }
            }
            steps {
                sh '''
                    set -eu
                    PROD_CONTAINER="smartstock-container"
                    BACKUP_TAG="smartstock-app:rollback-${BUILD_NUMBER}"
                    NEW_IMAGE="$FULL_IMAGE_NAME:$IMAGE_TAG"

                    echo "Preparing production deployment from $SOURCE_BRANCH."
                    echo "New image: $NEW_IMAGE"
                    docker image inspect "$NEW_IMAGE" >/dev/null

                    OLD_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$PROD_CONTAINER")"
                    docker tag "$OLD_IMAGE_ID" "$BACKUP_TAG"
                    echo "Rollback image saved as $BACKUP_TAG"

                    docker rm -f "$PROD_CONTAINER"

                    if ! docker run -d --name "$PROD_CONTAINER" --restart unless-stopped \
                        -p 8080:80 -e "APP_NAME=SmartStock AI" -e "APP_ENV=production" "$NEW_IMAGE"; then
                        echo "Production startup failed; restoring previous image."
                        docker rm -f "$PROD_CONTAINER" 2>/dev/null || true
                        docker run -d --name "$PROD_CONTAINER" --restart unless-stopped \
                            -p 8080:80 -e "APP_NAME=SmartStock AI" -e "APP_ENV=production" "$BACKUP_TAG"
                        exit 1
                    fi

                    HEALTHY=false
                    for attempt in $(seq 1 15); do
                        sleep 2
                        if docker exec "$PROD_CONTAINER" wget -q -O /dev/null http://127.0.0.1/; then
                            HEALTHY=true
                            echo "Production health check passed."
                            break
                        fi
                        echo "Production health check attempt $attempt failed."
                    done

                    if [ "$HEALTHY" != "true" ]; then
                        echo "Production verification failed."
                        docker logs --tail 50 "$PROD_CONTAINER" || true
                        echo "Restoring previous production image."
                        docker rm -f "$PROD_CONTAINER" 2>/dev/null || true
                        docker run -d --name "$PROD_CONTAINER" --restart unless-stopped \
                            -p 8080:80 -e "APP_NAME=SmartStock AI" -e "APP_ENV=production" "$BACKUP_TAG"

                        ROLLBACK_OK=false
                        for attempt in $(seq 1 10); do
                            sleep 2
                            if docker exec "$PROD_CONTAINER" wget -q -O /dev/null http://127.0.0.1/; then
                                ROLLBACK_OK=true
                                break
                            fi
                        done
                        if [ "$ROLLBACK_OK" != "true" ]; then
                            echo "CRITICAL: Rollback health check failed."
                            docker logs --tail 50 "$PROD_CONTAINER" || true
                        else
                            echo "Previous production image restored successfully."
                        fi
                        exit 1
                    fi

                    echo "Production deployment succeeded."
                    docker ps --filter "name=$PROD_CONTAINER"
                '''
            }
        }

        stage('Jira Build Information') {
            steps {
                script {
                    echo "Jenkins build: #${env.BUILD_NUMBER}"
                    echo "Git commit: ${env.GIT_SHORT_COMMIT}"
                    echo "Image tag: ${env.IMAGE_TAG}"
                    echo "Jira project: ${env.JIRA_PROJECT_KEY}"
                    if (env.JIRA_ISSUE_KEY != null && !env.JIRA_ISSUE_KEY.trim().isEmpty()) {
                        echo "Related Jira issue: ${env.JIRA_ISSUE_KEY}"
                    } else {
                        echo 'No related Jira issue detected.'
                    }
                    echo 'GitHub for Atlassian handles development linking.'
                    echo 'This stage reports build information; it does not call the Jira REST API.'
                }
            }
        }
    }

    post {
        success {
            echo 'SUCCESS: SmartStock Jenkins pipeline completed.'
        }
        failure {
            echo 'FAILURE: Review Console Output for the failed stage.'
        }
        always {
            echo "Build #${env.BUILD_NUMBER}: ${currentBuild.currentResult}"
        }
    }
}
