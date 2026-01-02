# Git Analyzer

A powerful local tool for analyzing Git repositories from Azure DevOps, GitHub, and GitLab. Git Analyzer provides deep insights into development activity, code churn, and project health through an intuitive dashboard.

## Features

- **Multi-Platform Support**: Connect to Azure DevOps
- **Interactive Dashboard**: Visualize commit activity, contributor stats, and project trends.
- **Deep Analytics**: Analyze code churn, file changes, and development velocity.
- **AI-Powered Insights**: Optional integration with LocalLLM (Ollama) for intelligent code summarization and pattern analysis.
- **Developer Profiles**: detailed activity tracking for individual contributors.
- **Export Capabilities**: Export data for external reporting.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Node.js, Express
- **Database**: SQLite (via `better-sqlite3`)
- **AI**: Ollama (Local LLM Integration)

## Git Operations & Security

This application is designed with security as a priority. It is strictly **Read-Only** and **does not execute any local shell commands**.

- **Zero Shell Execution**: The application does NOT use `exec`, `spawn`, or `child_process` to run `git` commands on your machine.
- **REST API Only**: All git-related data (history, diffs, blame) is fetched exclusively via provider REST APIs (Azure DevOps, GitHub, GitLab).
- **No Source Code Modification**: The tool never pushes, commits, or modifies your repository code or history.

### Git Command Mapping
Since the app uses APIs instead of local commands, here is how features map to Git concepts:

| Git Concept | Implementation |
| :--- | :--- |
| `git log` | Fetched via `GET .../commits` |
| `git show <commit>` | Fetched via `GET .../commits/{sha}` |
| `git diff` | Fetched via `GET .../diffs` |
| `git status` | N/A (Live working tree not monitored) |

### Verified API Operations
The application uses the following read-only API endpoints:
- **Azure DevOps**:
  - `GET _apis/git/repositories` (List Repos)
  - `GET _apis/git/repositories/{repo}/commits` (Fetch History)
  - `GET _apis/git/repositories/{repo}/commits/{sha}/changes` (Analyze Changes)
  - `GET _apis/git/repositories/{repo}/diffs` (View Diffs)
- **GitHub**:
  - `GET /repos/{owner}/{repo}` (Repo Details)
  - `GET /repos/{owner}/{repo}/commits` (Fetch History)
  - `GET /repos/{owner}/{repo}/commits/{sha}` (Commit Details)
- **GitLab**:
  - `GET /projects/{id}/repository/commits` (Fetch History)
  - `GET /projects/{id}/repository/commits/{sha}/diff` (View Diffs)

## Getting Started

### macOS

#### Prerequisites
- **Node.js**: Install via Homebrew: `brew install node`
- **Git**: Install via Homebrew: `brew install git`
- **(Optional) Ollama**: Download from [ollama.com](https://ollama.com/)

#### Installation & Running
1. Open Terminal.
2. Clone the repository:
   ```bash
   git clone <repository-url>
   cd git-analyzer
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   # Or for development:
   npm run dev
   ```
5. To stop the server, press `Ctrl + C`.

### Windows

#### Prerequisites
- **Node.js**: Download installer from [nodejs.org](https://nodejs.org/) or use Winget: `winget install OpenJS.NodeJS`
- **Git**: Download installer from [git-scm.com](https://git-scm.com/) or use Winget: `winget install Git.Git`
- **(Optional) Ollama**: Download from [ollama.com](https://ollama.com/)

#### Installation & Running
1. Open PowerShell or Command Prompt.
2. Clone the repository:
   ```bash
   git clone <repository-url>
   cd git-analyzer
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   # Or for development:
   npm run dev
   ```
5. To stop the server, press `Ctrl + C`.

The application will be available at [http://localhost:3000](http://localhost:3000).

## Configuration

### Azure DevOps Credentials

To analyze Azure DevOps repositories, you need to configure your credentials:

1. **Generate a Personal Access Token (PAT):**
   - Go to your Azure DevOps User Settings > Personal Access Tokens.
   - Create a new token with **Code (Read)** scope.

2. **Add Platform in Git Analyzer:**
   - Navigate to **Settings** in the web interface.
   - Click **+ Add Platform**.
   - Select **Azure DevOps**.
   - Enter your **Organization URL** (e.g., `https://dev.azure.com/myorg`).
   - Leave **Username** blank if using a PAT.
   - Enter your **PAT** in the Token field.
   - Click **Add Platform**.

### LocalLLM (Ollama) Setup

Git Analyzer supports local AI models for generating commit summaries and code analysis. This feature is **optional** and runs entirely on your machine.

> [!WARNING]
> **Resource Usage**: Running local LLMs can be resource-intensive. We recommend using smaller, efficient models (like `llama3:8b` or `mistral`) unless you have a high-performance GPU. Avoid using very large models (70B+) on standard consumer hardware.

1. **Install Ollama:**
   - Download and install from [ollama.com](https://ollama.com/).

2. **Pull a Model:**
   ```bash
   ollama pull llama3
   ```

3. **Configure in App:**
   - Go to **Settings** > **Ollama (AI)**.
   - **Endpoint**: Default is `http://localhost:11434`.
   - **Model**: Enter the model tag you pulled (e.g., `llama3`).
   - Click **Test Connection** to verify availability.
   - Click **Save**.

## Usage Guide

- **Dashboard**: Overview of all connected repositories and recent activity.
- **Repositories**: Manage and sync specific repositories. Click "Sync" to fetch the latest commits.
- **Developers**: View individual contributor statistics and group aliases (e.g., linking "John Doe" and "jdoe").
- **Analytics**: Deep dive into code frequency, impact, and churn metrics.
- **Settings**: Configure platforms, AI settings, and system preferences.

## Updating the App

To update the application to the latest version:

```bash
git pull origin main
npm install
npm run dev
```
