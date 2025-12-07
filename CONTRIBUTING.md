# Contributing to aws-backstage-infra

Thank you for your interest in contributing to aws-backstage-infra! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and constructive in all interactions.

## Getting Started

### Prerequisites

- Java 21+
- Maven 3.8+
- AWS CLI configured with appropriate credentials
- CDK CLI (`npm install -g aws-cdk`)
- kubectl
- Helm 3.x

### Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/stxkxs/aws-backstage-infra.git
   cd aws-backstage-infra
   ```

2. Build the cdk-common dependency:
   ```bash
   mvn -f ../cdk-common/pom.xml clean install
   ```

3. Build the project:
   ```bash
   mvn clean install
   ```

4. Copy and configure context:
   ```bash
   cp cdk.context.template.json cdk.context.json
   # Edit cdk.context.json with your settings
   ```

5. Validate the build:
   ```bash
   cdk synth
   ```

## Development Workflow

### Branch Naming

Use the following prefixes:
- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks

Example: `feat/add-redis-cache`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

Examples:
```
feat(helm): add horizontal pod autoscaler support
fix(database): correct connection pool configuration
docs(readme): update deployment instructions
```

### Code Style

This project uses:
- **Checkstyle** for Java code style
- **SpotBugs** for static analysis
- **Spotless** for code formatting

Run before committing:
```bash
mvn spotless:apply
mvn checkstyle:check
mvn spotbugs:check
```

### Testing

Run all tests:
```bash
mvn test
```

Run specific test class:
```bash
mvn test -Dtest=DeploymentConfTest
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run all checks locally:
   ```bash
   mvn clean verify
   ```
4. Push your branch and create a PR
5. Fill out the PR template completely
6. Request review from maintainers
7. Address review feedback
8. Squash and merge once approved

## Project Structure

```
aws-backstage-infra/
├── src/main/java/          # Java source code
├── src/main/resources/     # Configuration templates
├── src/test/               # Test code
├── helm/chart/backstage/   # Helm chart
├── docs/                   # Documentation
├── .github/                # GitHub workflows and templates
└── plans/                  # Future implementation plans
```

## Adding New Features

### Adding a New Helm Value

1. Update `helm/chart/backstage/values.yaml`
2. Reference in appropriate template file
3. Update documentation
4. Add tests if applicable

### Adding a New AWS Resource

1. Add configuration template in `src/main/resources/`
2. Update `DeploymentConf.java` if needed
3. Add to appropriate nested stack
4. Update documentation
5. Add configuration tests

### Adding a New Workflow

1. Create workflow file in `.github/workflows/`
2. Follow existing patterns for consistency
3. Document any required secrets
4. Test workflow manually first

## Documentation

Update documentation when:
- Adding new features
- Changing configuration options
- Modifying deployment steps
- Adding new dependencies

Documentation locations:
- `README.md` - Project overview
- `docs/` - Detailed guides
- `.github/AI_CONTEXT.md` - AI assistant context
- Code comments - Implementation details

## Release Process

See [RELEASING.md](RELEASING.md) for release procedures.

## Getting Help

- Check existing [issues](https://github.com/stxkxs/aws-backstage-infra/issues)
- Review [documentation](docs/)
- Create a new issue for bugs or feature requests

## License

By contributing, you agree that your contributions will be licensed under the project's license.
