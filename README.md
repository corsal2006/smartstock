# SmartStock AI — Enterprise Inventory & POS System

A Dockerized inventory management and point-of-sale project with a Jenkins-based CI/CD pipeline, automated validation, Docker image publishing, isolated test deployment, production deployment, and rollback support.

**Repository:** [corsal2006/smartstock](https://github.com/corsal2006/smartstock)

---

## Table of Contents

- [Overview](#overview)
- [Project Highlights](#project-highlights)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [CI/CD Pipeline](#cicd-pipeline)
- [Docker Images](#docker-images)
- [Deployment Environments](#deployment-environments)
- [Prerequisites](#prerequisites)
- [Run Locally](#run-locally)
- [Run with Docker](#run-with-docker)
- [Jenkins Setup](#jenkins-setup)
- [GitHub Webhook](#github-webhook)
- [Pipeline Configuration](#pipeline-configuration)
- [Health Checks and Verification](#health-checks-and-verification)
- [Rollback Strategy](#rollback-strategy)
- [Jira Integration Status](#jira-integration-status)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [Author](#author)

---

## Overview

SmartStock AI is an inventory and point-of-sale project designed to demonstrate application containerization and automated software delivery using DevOps practices.

The project uses Jenkins to automate the CI/CD workflow, Docker to package and run the application, Docker Hub to publish container images, and separate test and production containers to reduce deployment risk.

The pipeline validates the project, installs dependencies, runs configured quality checks, builds and publishes a Docker image, verifies a test deployment, and deploys to production when the required conditions are satisfied.

## Project Highlights

- **Continuous Integration:** Automated checkout, dependency installation, linting, and unit-test stages.
- **Containerization:** Packages the application into a Docker image.
- **Image Publishing:** Publishes versioned images to Docker Hub.
- **Test Deployment:** Runs a separate test container on port `8081`.
- **Production Deployment:** Runs the production container on port `8080`.
- **Deployment Verification:** Checks whether the deployed application responds successfully.
- **Rollback Support:** Preserves a backup image and attempts to restore it if production deployment or verification fails.
- **Jenkins Automation:** Uses a declarative `Jenkinsfile` stored in the repository.
- **Optional Security Scanning:** Includes an optional Trivy stage that is disabled by default in the current pipeline configuration.

## Technology Stack

| Technology | Purpose |
|---|---|
| Application frontend | SmartStock inventory and POS interface |
| Node.js 22 | Jenkins build environment |
| npm | Dependency installation and project scripts |
| Jenkins | CI/CD orchestration |
| Docker | Application containerization |
| Docker Hub | Container image registry |
| Git and GitHub | Source control and repository hosting |
| Cloudflare Quick Tunnel | Temporary external access for webhook testing |
| Jira Cloud | Project and issue-tracking environment |

The exact frontend libraries and application dependencies are defined by the project's package files.

## Architecture

```text
                 Developer
                     |
                     v
              GitHub Repository
              corsal2006/smartstock
                     |
                     v
                Jenkins
              Port 8082:8080
                     |
                     v
             Checkout and Validate
                     |
                     v
            Install and Test Code
                     |
                     v
             Build Docker Image
                     |
                     v
               Docker Hub
             sidd2294/smartstock
                     |
                     v
              Test Deployment
                Port 8081
                     |
                     v
             Verify HTTP Response
                     |
                     v
           Production Deployment
                Port 8080
                     |
              Health Verification
                     |
          +----------+----------+
          |                     |
        Success               Failure
          |                     |
          v                     v
     Deployment Live       Attempt Rollback
```

## CI/CD Pipeline

The pipeline is defined in the root-level `Jenkinsfile`.

### Pipeline stages

| Stage | Responsibility |
|---|---|
| Checkout SCM | Retrieves the source code from GitHub. |
| Validate Project | Checks the project structure and required files. |
| Check Build Tools | Checks the required build tools. |
| Install Dependencies | Installs project dependencies using npm. |
| Lint and Unit Tests | Runs the configured lint and test commands. |
| Build Docker Image | Creates a container image for the application. |
| Security Scan | Optional Trivy scan; disabled by default. |
| Publish Docker Image | Publishes the image when publishing is enabled. |
| Deploy Separate Test Container | Deploys an isolated test instance on port `8081`. |
| Verify Test Deployment | Checks whether the test deployment responds successfully. |
| Deploy Production | Deploys the application to port `8080` when deployment conditions are met. |
| Jira Build Information | Prints build and issue-related information to the Jenkins log. |

### Production deployment conditions

Production deployment is controlled by the pipeline parameters and branch conditions. The current configuration uses:

- `DEPLOY_PRODUCTION`
- `DEPLOY_LOCAL`
- The `main` or `master` branch

Review the `Jenkinsfile` for the exact conditions before changing pipeline behavior.

## Docker Images

**Docker Hub namespace:** `sidd2294/smartstock`

The pipeline creates tagged images so builds can be identified and deployment versions can be traced.

An example of a verified production image tag is:

```text
sidd2294/smartstock:production-24-daf2d49
```

The tag above identifies a previously verified build; the latest tag can change with subsequent builds.

Open the registry:

[Docker Hub — SmartStock](https://hub.docker.com/r/sidd2294/smartstock)

### View local images

```powershell
docker images sidd2294/smartstock
```

### Inspect the production image

```powershell
docker inspect smartstock-container --format "{{.Config.Image}}"
```

### Inspect the test image

```powershell
docker inspect smartstock-jenkins-test --format "{{.Config.Image}}"
```

## Deployment Environments

The Jenkins setup uses separate containers for testing and production.

| Environment | Container | Host port | Purpose |
|---|---|---:|---|
| Jenkins | `jenkins` | `8082` | CI/CD server |
| Test | `smartstock-jenkins-test` | `8081` | Validate a candidate deployment |
| Production | `smartstock-container` | `8080` | Run the production application |

### Access the services

- Jenkins: [http://localhost:8082](http://localhost:8082)
- Test application: [http://localhost:8081](http://localhost:8081)
- Production application: [http://localhost:8080](http://localhost:8080)

These localhost addresses are intended for the machine running the containers.

## Prerequisites

Install or configure the following before setting up the project:

- Git
- Docker Desktop
- Node.js 22 and npm, if running the application or its scripts directly
- Jenkins
- A GitHub repository with access to the project
- A Docker Hub account and repository
- Jenkins credentials for Docker Hub publishing

Jira credentials are only necessary if you later implement authenticated Jira API operations.

## Run Locally

Clone the repository:

```powershell
git clone https://github.com/corsal2006/smartstock.git
cd smartstock
```

Install dependencies:

```powershell
npm install
```

Inspect the available npm scripts:

```powershell
npm run
```

Run the scripts defined in `package.json`. For example, if the project defines these scripts:

```powershell
npm run lint
npm test
```

Run only scripts that are actually present in the project's `package.json`.

## Run with Docker

Build the Docker image from the repository root:

```powershell
docker build -t smartstock-app:local .
```

Run the container:

```powershell
docker run -d --name smartstock-local -p 8083:80 smartstock-app:local
```

Open:

[http://localhost:8083](http://localhost:8083)

Check the container:

```powershell
docker ps
docker logs smartstock-local
```

Stop and remove the local container when finished:

```powershell
docker stop smartstock-local
docker rm smartstock-local
```

This standalone local container is separate from the Jenkins-managed test and production containers.

## Jenkins Setup

### 1. Start Jenkins

The existing Docker-based setup exposes Jenkins on host port `8082`.

Check whether it is running:

```powershell
docker ps
```

Start it if it is stopped:

```powershell
docker start jenkins
```

Open [http://localhost:8082](http://localhost:8082).

### 2. Configure the Node.js tool

In Jenkins, navigate to:

**Manage Jenkins → Tools → NodeJS installations**

Configure the Node.js installation with the name:

```text
NodeJS-22
```

The name must match the tool reference used in the `Jenkinsfile`.

### 3. Configure Docker Hub credentials

In Jenkins, navigate to:

**Manage Jenkins → Credentials**

Create or verify the credential with ID:

```text
docker-registry-credentials
```

Use the appropriate Docker Hub authentication details. Do not store passwords or access tokens directly in the `Jenkinsfile` or repository.

### 4. Configure the pipeline job

The Jenkins job is named:

```text
SmartStock-CI-CD
```

Use a Pipeline from SCM configuration pointing to:

- SCM: Git
- Repository: `https://github.com/corsal2006/smartstock.git`
- Branch: `*/main`
- Script path: `Jenkinsfile`

Save the job and run **Build Now** to test the configuration.

## GitHub Webhook

The Jenkins job has the **GitHub hook trigger for GITScm polling** option enabled.

For GitHub webhook delivery to work, Jenkins must be reachable from GitHub. A local-only address such as `localhost:8082` cannot be reached directly by GitHub's servers.

The webhook endpoint follows this pattern:

```text
https://YOUR-REACHABLE-JENKINS-ADDRESS/github-webhook/
```

Configure the webhook in:

**GitHub Repository → Settings → Webhooks → Add webhook**

Use:

- Payload URL: your reachable Jenkins webhook URL
- Content type: `application/json`
- Events: push events
- Active: enabled

A temporary Cloudflare Quick Tunnel was used during setup. Its URL can change, and the tunnel must remain running while it is needed.

**Security note:** Do not expose Jenkins publicly without appropriate access controls. Use a secure, trusted connection and configure webhook secrets or other protections where supported.

A successful webhook ping confirms connectivity for that delivery. Verify a real push triggers a new Jenkins build before treating automatic push-triggered builds as fully tested.

## Pipeline Configuration

The current pipeline includes configuration flags for publishing, local deployment, production deployment, and optional scanning.

| Parameter | Purpose |
|---|---|
| `PUBLISH_IMAGE` | Controls Docker image publishing. |
| `DEPLOY_LOCAL` | Controls local container deployment. |
| `DEPLOY_PRODUCTION` | Controls production deployment. |
| `RUN_TRIVY` | Enables the optional Trivy security scan. |

Refer to the `Jenkinsfile` for the current default values and conditions.

### View the pipeline source

[Open Jenkinsfile on GitHub](https://github.com/corsal2006/smartstock/blob/main/Jenkinsfile)

## Health Checks and Verification

After a deployment, verify the containers and application responses.

### Check container status

```powershell
docker ps
```

### Check the production container

```powershell
docker inspect smartstock-container --format "{{.State.Status}}"
```

### Check the test container

```powershell
docker inspect smartstock-jenkins-test --format "{{.State.Status}}"
```

### Test the HTTP endpoints

```powershell
Invoke-WebRequest http://localhost:8080
Invoke-WebRequest http://localhost:8081
```

A successful HTTP response confirms that the endpoint responded. It does not, by itself, prove that every application feature is working correctly.

The current deployment verification checks the application's root HTTP endpoint. Do not assume a `/healthz` endpoint exists unless it is implemented in the application or web-server configuration.

## Rollback Strategy

The production deployment stage preserves a backup image before replacing the running production container.

If the new deployment or its verification fails, the pipeline attempts to restore the previous image.

This provides a basic recovery mechanism for failed container deployments.

For production use, further improvements should include:

- Persistent image tags and release history
- Explicit application-level readiness checks
- Rollback verification
- Deployment logs and alerts
- A documented recovery procedure

A rollback attempt should always be verified by checking the container's image, status, and HTTP response.

## Jira Integration Status

The pipeline includes a **Jira Build Information** stage that prints build and issue-related information in the Jenkins log.

The current `Jenkinsfile` does **not** perform an authenticated Jira REST API update. Therefore, automatic Jira issue transitions, build comments, or deployment-status updates should not be considered implemented until those API operations are added and tested.

Jira project:

- Site: `siddeshnaik292006.atlassian.net`
- Project key: `SMAR`

For real Jira integration, store credentials securely in Jenkins and implement the required API calls with appropriate error handling.

## Troubleshooting

### Jenkins is not opening

Check the container:

```powershell
docker ps -a
docker logs jenkins
```

Restart it if necessary:

```powershell
docker restart jenkins
```

### Docker image publishing fails

Verify that:

- The `docker-registry-credentials` credential exists.
- The credentials have permission to publish to `sidd2294/smartstock`.
- Docker Hub is reachable.
- The image tag is valid.

### Test deployment fails

Inspect the test container:

```powershell
docker logs smartstock-jenkins-test
docker inspect smartstock-jenkins-test
```

Check whether port `8081` is already occupied.

### Production deployment fails

Inspect the container and logs:

```powershell
docker logs smartstock-container
docker inspect smartstock-container
```

Review the Jenkins console output to determine whether deployment verification or rollback failed.

### GitHub pushes do not trigger Jenkins

Verify that:

1. The Jenkins job has the GitHub hook trigger enabled.
2. GitHub's webhook delivery succeeds.
3. The webhook URL is reachable.
4. The tunnel, if used, is running.
5. Jenkins is configured to build the correct repository and branch.

### Lint or test stages fail

Check the console output and verify that the relevant npm scripts and dependencies exist in `package.json`.

## Future Improvements

Potential improvements for the project include:

- Implement and test authenticated Jira REST API integration.
- Enable and verify Trivy image scanning.
- Add automated security and dependency checks.
- Introduce explicit application readiness and health endpoints.
- Add deployment notifications.
- Configure a permanent, secure webhook endpoint.
- Improve release management and rollback auditing.
- Add automated end-to-end tests.

These are proposed improvements, not claims that the features are already complete.

## Author

**Siddesh Naik**

- GitHub: [@corsal2006](https://github.com/corsal2006)
- Project repository: [SmartStock](https://github.com/corsal2006/smartstock)

---

## License

Add a `LICENSE` file to the repository if you intend to publish this project under a specific open-source license.
