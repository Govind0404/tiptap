FROM public.ecr.aws/x8v8d7g8/mars-base:latest
WORKDIR /app

# Ensure devDependencies are installed and skip Husky during CI builds
ENV NODE_ENV=development \
    HUSKY=0

# Copy repository contents
COPY . .

# Install JS/TS monorepo deps (pnpm is provided by base image)
RUN pnpm install --frozen-lockfile

# Default to interactive shell for development
CMD ["/bin/bash"]
