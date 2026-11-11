# Contributing to Evalix

First off, thank you for considering contributing to Evalix! It's people like you that make open-source such a great community.

## Development Setup

1. **Fork the repo** and clone it locally.
2. **Install dependencies** for both the client and server:
   ```bash
   cd client && npm install
   cd ../server && npm install
   ```
3. **Environment variables**: Copy `.env.example` to `.env` in both `client` and `server` folders and fill in the required keys.
4. **Run the development servers**:
   - Client: `npm run dev` (in the `client` folder)
   - Server: `npm run dev` (in the `server` folder)

## Pull Request Process

1. Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2. Update the README.md with details of changes to the interface, if applicable.
3. Verify your changes against our linting and tests (once testing is fully implemented).
4. You may merge the Pull Request in once you have the sign-off of at least one other developer.

## Code of Conduct

Please note we have a Code of Conduct, please follow it in all your interactions with the project.
