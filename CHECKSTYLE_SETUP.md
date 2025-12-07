# Checkstyle Setup

This document describes how to set up and use Checkstyle for code quality enforcement.

## Overview

This project uses Checkstyle to enforce consistent code style across all Java files.

## Configuration Files

| File | Purpose |
|------|---------|
| `checkstyle.xml` | Main Checkstyle rules configuration |
| `eclipse-formatter.xml` | Eclipse/IntelliJ formatter settings |

## Maven Integration

Checkstyle is integrated via Maven plugin:

```xml
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-checkstyle-plugin</artifactId>
    <version>3.6.0</version>
    <configuration>
        <configLocation>checkstyle.xml</configLocation>
        <consoleOutput>true</consoleOutput>
        <failsOnError>true</failsOnError>
    </configuration>
</plugin>
```

## Running Checkstyle

### Command Line

```bash
# Check only
mvn checkstyle:check

# Generate report
mvn checkstyle:checkstyle
```

### During Build

Checkstyle runs automatically during:
```bash
mvn verify
```

## IDE Integration

### IntelliJ IDEA

1. Install CheckStyle-IDEA plugin:
   - Settings → Plugins → Marketplace
   - Search "CheckStyle-IDEA"
   - Install and restart

2. Configure plugin:
   - Settings → Tools → Checkstyle
   - Click "+" to add configuration
   - Select "Use a local Checkstyle file"
   - Browse to `checkstyle.xml`
   - Set as active configuration

3. Import code style:
   - Settings → Editor → Code Style → Java
   - Gear icon → Import Scheme → Eclipse XML Profile
   - Select `eclipse-formatter.xml`

### Eclipse

1. Install Checkstyle plugin:
   - Help → Eclipse Marketplace
   - Search "Checkstyle"
   - Install "Checkstyle Plug-in"

2. Configure project:
   - Right-click project → Properties
   - Checkstyle → Local Check Configurations
   - New → External Configuration File
   - Browse to `checkstyle.xml`

3. Enable Checkstyle:
   - Right-click project → Checkstyle → Activate Checkstyle

### VS Code

1. Install extension:
   - Extensions → Search "Checkstyle for Java"
   - Install by Sheng Chen

2. Configure:
   - Settings → Extensions → Checkstyle
   - Set "Checkstyle: Configuration" to `checkstyle.xml` path

## Rules Overview

### Naming Conventions

| Rule | Pattern |
|------|---------|
| Package names | `^[a-z]+(\.[a-z][a-z0-9]*)*$` |
| Class names | `^[A-Z][a-zA-Z0-9]*$` |
| Method names | `^[a-z][a-zA-Z0-9]*$` |
| Constants | `^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$` |
| Parameters | `^[a-z][a-zA-Z0-9]*$` |

### Formatting

- Indentation: 2 spaces
- Max line length: 120 characters
- Braces: Required for all blocks
- Whitespace: Around operators

### Imports

- No star imports
- Unused imports flagged
- Import order enforced

### Documentation

- Javadoc required for public APIs
- Missing @param/@return flagged (warning)

## Suppressing Warnings

### Inline Suppression

```java
@SuppressWarnings("checkstyle:MagicNumber")
public void method() {
    int value = 42; // Suppressed
}
```

### Comment Suppression

```java
// CHECKSTYLE:OFF
int value = 42;
// CHECKSTYLE:ON
```

### Configuration Suppression

In `checkstyle.xml`:
```xml
<module name="SuppressionFilter">
    <property name="file" value="checkstyle-suppressions.xml"/>
</module>
```

## Common Issues

### "Line is longer than 120 characters"

```java
// Break long lines
String longString = "This is a very long string that "
    + "should be broken across multiple lines";
```

### "Missing Javadoc"

```java
/**
 * Brief description.
 *
 * @param param description
 * @return description
 */
public String method(String param) {
    return param;
}
```

### "Unused import"

Remove the unused import or use the class.

### "Magic number"

```java
// Instead of
int timeout = 5000;

// Use
private static final int TIMEOUT_MS = 5000;
```

## Updating Rules

1. Edit `checkstyle.xml`
2. Test changes:
   ```bash
   mvn checkstyle:check
   ```
3. Update IDE configuration
4. Document changes

## Resources

- [Checkstyle Documentation](https://checkstyle.org/)
- [Available Checks](https://checkstyle.org/checks.html)
- [Configuration](https://checkstyle.org/config.html)
