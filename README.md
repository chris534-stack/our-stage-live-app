# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## VoxCPM Cloud Run Service

This repository also packages the VoxCPM text-to-speech API that will be deployed to Cloud Run. The container build context lives at the project root and expects the service code under `services/voxcpm/`.

### Directory layout

- **Dockerfile** – builds the VoxCPM service image (GPU-ready base via CUDA 12.2 runtime)
- **services/voxcpm/** – Python sources and dependency manifests for the VoxCPM FastAPI service
  - **requirements.txt** – installable dependencies (update to include the real VoxCPM package)
  - **voxcpm_service/app.py** – placeholder FastAPI application exposing `/health` and `/synthesize`

### Build the container

```sh
docker build -t gcr.io/[PROJECT-ID]/voxcpm-service .
```

Swap `[PROJECT-ID]` for your Google Cloud project ID. Add `--platform linux/amd64` if building on Apple Silicon for Cloud Run.

### Push to Artifact Registry

```sh
docker push gcr.io/[PROJECT-ID]/voxcpm-service
```

Authenticate Docker with `gcloud auth configure-docker` first.

### Build remotely with Google Cloud Build (no local Docker required)

If Docker Desktop is unavailable, submit the build to Google Cloud Build. Replace placeholders with your own values:

```sh
gcloud config set project [PROJECT-ID]
gcloud builds submit --tag us-central1-docker.pkg.dev/[PROJECT-ID]/voxcpm/voxcpm-service .
```

Prerequisites:

- Enable APIs once per project: `gcloud services enable artifactregistry.googleapis.com run.googleapis.com cloudbuild.googleapis.com`
- Create (or reuse) an Artifact Registry repo:
  ```sh
  gcloud artifacts repositories create voxcpm \
    --repository-format=docker \
    --location=us-central1
  ```
  (Skip if the repository already exists.)

Cloud Build will run `docker build` on Google-managed infrastructure and push the image to Artifact Registry.

### Deploy to Cloud Run

```sh
gcloud run deploy voxcpm-service \
  --image gcr.io/[PROJECT-ID]/voxcpm-service \
  --platform managed \
  --region [REGION] \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --port 8080
```

If GPU acceleration is required, include `--accelerator type=nvidia-l4,count=1` and set the region to one that supports GPUs.

### Connect from the Firebase site

Use `fetch` or `axios` in the Next.js application to POST to the Cloud Run URL. Optionally, create a Firebase Hosting rewrite that proxies `/api/tts` to the Cloud Run service to keep API calls on the same domain.
