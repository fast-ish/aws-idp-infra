.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Available targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-20s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

.PHONY: install
install: ## Install dependencies
	mvn clean install -DskipTests

.PHONY: compile
compile: ## Compile the project
	mvn clean compile

.PHONY: test
test: ## Run unit tests
	mvn test

.PHONY: coverage
coverage: ## Generate code coverage report
	mvn clean test jacoco:report
	@echo "Coverage report available at: target/site/jacoco/index.html"

.PHONY: quality
quality: ## Run all quality checks
	mvn clean verify spotbugs:check pmd:check checkstyle:check

.PHONY: spotbugs
spotbugs: ## Run SpotBugs analysis
	mvn clean compile spotbugs:check

.PHONY: pmd
pmd: ## Run PMD analysis
	mvn clean compile pmd:check pmd:cpd-check

.PHONY: checkstyle
checkstyle: ## Run Checkstyle analysis
	mvn clean compile checkstyle:check

.PHONY: format
format: ## Format code using Spotless
	mvn spotless:apply

.PHONY: clean
clean: ## Clean build artifacts
	mvn clean
	rm -rf cdk.out

.PHONY: build
build: ## Build the project
	mvn clean package

.PHONY: validate
validate: ## Validate CDK templates with cfn-lint
	@if [ -f scripts/validate-templates.sh ]; then \
		scripts/validate-templates.sh; \
	else \
		echo "Error: scripts/validate-templates.sh not found"; \
		exit 1; \
	fi

.PHONY: synth
synth: ## Synthesize CDK app
	mvn exec:java -Dexec.mainClass="fasti.sh.execute.Build"

.PHONY: update-deps
update-deps: ## Update Maven dependencies
	mvn versions:use-latest-versions

.PHONY: check-deps
check-deps: ## Check for dependency updates
	mvn versions:display-dependency-updates

.PHONY: lint
lint: checkstyle pmd spotbugs ## Run all linters

.PHONY: verify
verify: ## Run full verification
	mvn clean verify

.PHONY: pre-commit
pre-commit: ## Run pre-commit checks
	mvn clean test checkstyle:check spotbugs:check

.PHONY: all
all: clean build test quality ## Run everything
