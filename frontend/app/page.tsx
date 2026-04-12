"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"
import { GitBranch, Server, Cloud, Zap, RefreshCw, Github, Container, ZoomIn, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CodeBlock } from "@/components/ui/code-block"
import { FeatureCard } from "@/components/ui/feature-card"
import { WorkflowDiagram } from "@/components/visuals/workflow-diagram"
import { BackendStatus } from "@/components/visuals/backend-status"
import { ManifestViewer } from "@/components/visuals/manifest-viewer"
import { JenkinsViewer } from "@/components/visuals/jenkins-viewer"
import { JenkinsSetup } from "@/components/visuals/jenkins-setup"
import { ArgoCDSetup } from "@/components/visuals/argocd-setup"
import { KubectlSetup } from "@/components/visuals/kubectl-setup"
import Link from "next/link"

const manifests = [
  {
    name: "Namespace",
    filename: "01-namespace.yaml",
    description: "Creates the 'fullstack' namespace to isolate resources.",
    code: `apiVersion: v1
kind: Namespace
metadata:
  name: fullstack`
  },
  {
    name: "ConfigMap",
    filename: "02-configmap.yaml",
    description: "Stores non-sensitive configuration like API URLs.",
    code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: fullstack-config
  namespace: fullstack
data:
  BACKEND_URL: "http://backend-service:5000"
  FLASK_ENV: "production"`
  },
  {
    name: "Secret",
    filename: "03-secret.yaml",
    description: "Stores sensitive data like API keys (Base64 encoded).",
    code: `apiVersion: v1
kind: Secret
metadata:
  name: fullstack-secrets
  namespace: fullstack
type: Opaque
data:
  API_SECRET_KEY: c3VwZXJzZWNyZXRrZXk=`
  },
  {
    name: "Backend PVC",
    filename: "04-backend-pvc.yaml",
    description: "Requests 1Gi of persistent storage for the backend.",
    code: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backend-pvc
  namespace: fullstack
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi`
  },
  {
    name: "Backend Deployment",
    filename: "05-backend-deploy.yaml",
    description: "Deploys the Python Flask backend with 2 replicas and persistent storage.",
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: fullstack
spec:
  replicas: 2
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      containers:
        - name: backend
          image: himanm/devops-project-3-backend:latest
          ports:
            - containerPort: 5000
          envFrom:
            - configMapRef:
                name: fullstack-config
            - secretRef:
                name: fullstack-secrets
          volumeMounts:
            - name: backend-storage
              mountPath: /app/data`
  },
  {
    name: "Backend Service",
    filename: "06-backend-service.yaml",
    description: "Exposes the backend internally on port 5000.",
    code: `apiVersion: v1
kind: Service
metadata:
  name: backend-service
  namespace: fullstack
spec:
  selector:
    app: backend
  ports:
    - protocol: TCP
      port: 5000
      targetPort: 5000
  type: ClusterIP`
  },
  {
    name: "Frontend Deployment",
    filename: "07-frontend-deploy.yaml",
    description: "Deploys the Next.js frontend and injects the backend URL.",
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: fullstack
spec:
  replicas: 1
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      containers:
        - name: frontend
          image: himanm/devops-project-3-frontend:latest
          ports:
            - containerPort: 3000
          env:
            - name: BACKEND_URL
              valueFrom:
                configMapKeyRef:
                  name: fullstack-config
                  key: BACKEND_URL`
  },
  {
    name: "Frontend Service",
    filename: "08-frontend-service.yaml",
    description: "Exposes the frontend internally on port 3005.",
    code: `apiVersion: v1
kind: Service
metadata:
  name: frontend-service
  namespace: fullstack
spec:
  selector:
    app: frontend
  ports:
    - protocol: TCP
      port: 3005
      targetPort: 3000
  type: ClusterIP`
  },
  {
    name: "Frontend NodePort (Direct Access)",
    filename: "frontend-nodeport.yaml",
    description: "Exposes the frontend on NodePort 30005 for direct IP access.",
    code: `apiVersion: v1
kind: Service
metadata:
  name: frontend-nodeport
  namespace: fullstack
spec:
  type: NodePort
  selector:
    app: frontend
  ports:
    - protocol: TCP
      port: 3005
      targetPort: 3000
      nodePort: 30005`
  },
  {
    name: "Traefik Ingress (Option A)",
    filename: "traefik-ingress.yaml",
    description: "Configures Traefik Ingress Controller (Default for K3s).",
    code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fullstack-ingress
  namespace: fullstack
  annotations:
    traefik.ingress.kubernetes.io/router.entrypoints: web,websecure
    traefik.ingress.kubernetes.io/router.tls: "true"
spec:
  rules:
    - host: devops3.himanmanduja.fun
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 3005
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 5000`
  },
  {
    name: "Nginx Ingress (Option B)",
    filename: "nginx-ingress.yaml",
    description: "Configures Nginx Ingress Controller (Standard K8s).",
    code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: fullstack-ingress-nginx
  namespace: fullstack
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - devops3.himanmanduja.fun
      secretName: fullstack-tls
  rules:
    - host: devops3.himanmanduja.fun
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 3005
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: backend-service
                port:
                  number: 5000`
  },
  {
    name: "ArgoCD Application",
    filename: "argocd-application.yaml",
    description: "Defines the GitOps sync policy for the fullstack application.",
    code: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fullstack-app
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/HimanM/gitops-kubernetes-jenkins-argocd-platform.git
    targetRevision: HEAD
    path: k8s
    directory:
      exclude: 'argocd-ingress.yaml'
  destination:
    server: https://kubernetes.default.svc
    namespace: fullstack
  syncPolicy:
    automated:
      prune: true
      selfHeal: true`
  }
]

const jenkinsFiles = [
  {
    name: "Build Pipeline",
    filename: "Jenkinsfile",
    description: "Triggers on commit. Builds Docker images, runs tests, pushes to DockerHub, and triggers the Deploy pipeline.",
    icon: Zap,
    code: `pipeline {
    agent any
    environment {
        DOCKER_CRED = credentials('dockerhub-username')
        IMAGE_TAG = "\${BUILD_NUMBER}"
    }
    stages {
        stage('Build Docker Images') {
            steps {
                sh 'docker build -t $DOCKER_CRED_USR/devops-project-3-frontend:$IMAGE_TAG ./frontend'
                sh 'docker build -t $DOCKER_CRED_USR/devops-project-3-backend:$IMAGE_TAG ./backend'
            }
        }
        stage('Push to DockerHub') {
            steps {
                sh 'echo $DOCKER_CRED_PSW | docker login -u $DOCKER_CRED_USR --password-stdin'
                sh 'docker push $DOCKER_CRED_USR/devops-project-3-frontend:$IMAGE_TAG'
                sh 'docker push $DOCKER_CRED_USR/devops-project-3-backend:$IMAGE_TAG'
            }
        }
    }
    post {
        success {
            build job: 'DevOps-Deploy', parameters: [string(name: 'IMAGE_TAG', value: "\${env.BUILD_NUMBER}")]
        }
    }
}`
  },
  {
    name: "GitOps Deployment",
    filename: "Jenkinsfile.deploy",
    description: "Triggered by the Build pipeline. Updates K8s manifests in Git with the new image tag, triggering ArgoCD sync.",
    icon: GitBranch,
    code: `pipeline {
    agent any
    parameters {
        string(name: 'IMAGE_TAG', description: 'Docker Image Tag to deploy')
    }
    environment {
        DOCKER_CRED = credentials('dockerhub-username')
        GIT_CRED_ID = 'github-token' 
        REPO_URL = 'github.com/HimanM/gitops-kubernetes-jenkins-argocd-platform.git'
    }
    stages {
        stage('Update Manifests') {
            steps {
                script {
                    sh "sed -i 's|image: .*/devops-project-3-frontend:.*|image: $DOCKER_CRED_USR/devops-project-3-frontend:\${params.IMAGE_TAG}|' k8s/07-frontend-deploy.yaml"
                    sh "sed -i 's|image: .*/devops-project-3-backend:.*|image: $DOCKER_CRED_USR/devops-project-3-backend:\${params.IMAGE_TAG}|' k8s/05-backend-deploy.yaml"
                }
            }
        }
        stage('Push Changes') {
            steps {
                withCredentials([string(credentialsId: GIT_CRED_ID, variable: 'GITHUB_TOKEN')]) {
                    sh """
                        git config user.email "jenkins@himanmanduja.fun"
                        git config user.name "Jenkins CI"
                        git add k8s/05-backend-deploy.yaml k8s/07-frontend-deploy.yaml
                        git commit -m "Update image tags to \${params.IMAGE_TAG}"
                        git push https://\${GITHUB_TOKEN}@\${REPO_URL} main
                    """
                }
            }
        }
    }
}`
  }
]

export default function Home() {
  const [selectedImage, setSelectedImage] = useState<{ src: string, title: string } | null>(null)

  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section id="overview" className="relative pt-12 md:pt-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            DevOps Project 3
          </div>
          <h1 className="text-4xl md:text-7xl font-bold text-white mb-6 tracking-tight">
            Modern <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">GitOps</span> Workflow
          </h1>
          <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
            A complete guide to deploying full-stack applications on Kubernetes using Jenkins CI and ArgoCD GitOps.
            Automated, secure, and scalable.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="https://github.com/HimanM/gitops-kubernetes-jenkins-argocd-platform" target="_blank">
              <Button size="lg" className="bg-zinc-800 hover:bg-zinc-700 text-white gap-2">
                <Github className="h-4 w-4" /> GitHub Repo
              </Button>
            </Link>
            <Link href="https://hub.docker.com/repository/docker/himanm/devops-project-3-frontend" target="_blank">
              <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2">
                <Container className="h-4 w-4" /> DockerHub Frontend
              </Button>
            </Link>
            <Link href="https://hub.docker.com/repository/docker/himanm/devops-project-3-backend" target="_blank">
              <Button size="lg" variant="outline" className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white gap-2">
                <Container className="h-4 w-4" /> DockerHub Backend
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">System Architecture</h2>
            <p className="text-zinc-400">Visualizing the flow from code commit to production deployment.</p>
          </div>
        </div>

        <WorkflowDiagram />

        <div className="mt-8">
          <BackendStatus />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <FeatureCard
            title="Continuous Integration"
            description="Jenkins builds Docker images on every commit and pushes them to DockerHub with dynamic tagging."
            icon={Server}
            delay={0.1}
          />
          <FeatureCard
            title="GitOps Deployment"
            description="ArgoCD monitors the Git repository and automatically syncs Kubernetes manifests to the cluster."
            icon={GitBranch}
            delay={0.2}
          />
          <FeatureCard
            title="Kubernetes Cluster"
            description="K3s cluster hosting frontend and backend services with Ingress for external access."
            icon={Cloud}
            delay={0.3}
          />
        </div>

        <div className="pt-8 border-t border-zinc-800">
          <KubectlSetup />
        </div>
      </section>

      {/* Kubernetes Section */}
      <section id="kubernetes" className="space-y-8">
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Kubernetes Manifests</h2>
          <p className="text-zinc-400">Infrastructure as Code definitions for the application.</p>
        </div>

        <ManifestViewer manifests={manifests} />
      </section>

      {/* Jenkins Section */}
      <section id="jenkins" className="space-y-8">
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Jenkins CI Pipeline</h2>
          <p className="text-zinc-400">Automated build and test workflows.</p>
        </div>

        <JenkinsViewer files={jenkinsFiles} />

        <div className="pt-8 border-t border-zinc-800">
          <h3 className="text-2xl font-bold text-white mb-6">Setup Guide</h3>
          <JenkinsSetup />
        </div>
      </section>

      {/* ArgoCD Section */}
      <section id="argocd" className="space-y-8">
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">ArgoCD GitOps</h2>
          <p className="text-zinc-400">Continuous Deployment via Git.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-6">
            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-400" />
              Automated Sync
            </h3>
            <p className="text-zinc-400">
              ArgoCD watches the Git repository for changes. When Jenkins updates the deployment manifests with a new image tag, ArgoCD detects the drift and syncs the cluster to the desired state.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="text-2xl font-bold text-white mb-1">Self-Healing</div>
                <div className="text-xs text-zinc-500">Automatically fixes drift</div>
              </div>
              <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800">
                <div className="text-2xl font-bold text-white mb-1">Declarative</div>
                <div className="text-xs text-zinc-500">Git as source of truth</div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-mono text-zinc-500">k8s/argocd-application.yaml</span>
            </div>
            <CodeBlock
              language="yaml"
              code={`apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: fullstack-app
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/HimanM/gitops-kubernetes-jenkins-argocd-platform.git
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: fullstack
  syncPolicy:
    automated:
      prune: true
      selfHeal: true`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-8">
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white">Webhook Configuration</h3>
            <p className="text-zinc-400 text-sm">
              To trigger immediate syncs, configure a GitHub Webhook. Point the Payload URL to your ArgoCD instance (e.g., <code>https://argocd.himanmanduja.fun/api/webhook</code>) and select <code>application/json</code> as the content type.
            </p>
            <div
              className="relative aspect-video rounded-lg overflow-hidden border border-zinc-800 group cursor-pointer"
              onClick={() => setSelectedImage({ src: "/screenshots/github_webhooks.png", title: "GitHub Webhook Configuration" })}
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors z-10 flex items-center justify-center">
                <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100 duration-300" />
              </div>
              <Image
                src="/screenshots/github_webhooks.png"
                alt="GitHub Webhook Configuration"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold text-white">Application View</h3>
            <p className="text-zinc-400 text-sm">
              The ArgoCD dashboard provides a visual representation of your application&apos;s state, showing all resources and their sync status.
            </p>
            <div
              className="relative aspect-video rounded-lg overflow-hidden border border-zinc-800 group cursor-pointer"
              onClick={() => setSelectedImage({ src: "/screenshots/argocd-application.png", title: "ArgoCD Application View" })}
            >
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors z-10 flex items-center justify-center">
                <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity transform scale-75 group-hover:scale-100 duration-300" />
              </div>
              <Image
                src="/screenshots/argocd-application.png"
                alt="ArgoCD Application View"
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800">
          <ArgoCDSetup />
        </div>
      </section>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-7xl w-full max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute -top-12 right-0 flex items-center gap-4">
                <a
                  href={selectedImage.src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                  title="Open original"
                >
                  <ZoomIn className="h-6 w-6" />
                </a>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-2 text-zinc-400 hover:text-white transition-colors"
                >
                  <X className="h-8 w-8" />
                </button>
              </div>

              <div className="relative w-full h-[80vh] rounded-lg overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl">
                <Image
                  src={selectedImage.src}
                  alt={selectedImage.title}
                  fill
                  className="object-contain"
                  quality={100}
                />
              </div>

              <div className="mt-4 text-center">
                <h3 className="text-xl font-semibold text-white">{selectedImage.title}</h3>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
