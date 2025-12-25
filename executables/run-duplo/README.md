# Duplo Duplicate Code Detection Script

This script provides an automated way to detect duplicate code blocks in the codebase using [Duplo](https://github.com/dlidstrom/Duplo).

## Industry Standards Applied

This script follows industry best practices based on Duplo v2.0+:

### 1. **Optimal Threshold Settings**
- **Default: 20 lines minimum** (down from 60) - Industry standard for meaningful duplicates
- Configurable via `DUPLO_MIN_LINES` environment variable
- Based on research showing 15-25 lines captures genuine duplication

### 2. **Multi-threading Support**
- **Auto-detects CPU cores** for optimal performance (v2.0 feature)
- Uses `-j` flag for parallel processing
- Provides near-linear performance improvement on multi-core systems

### 3. **Multiple Output Formats**
- **Text report**: Human-readable output
- **JSON report**: Machine-readable for automation
- **XML report**: CI/CD integration with stylesheet support

### 4. **Smart Filtering**
- Ignores preprocessor directives by default (`-ip`)
- Excludes common build/dependency directories
- Supports custom file extensions

### 5. **Proper stdin Usage**
- Uses Unix pipeline pattern (recommended approach)
- Efficient file list handling

## Installation

### Option 1: Install via Go
```bash
# First install Go if not already installed
sudo apt update
sudo apt install golang-go

# Then install Duplo
go install github.com/dlidstrom/Duplo@latest
```

### Option 2: Download Pre-built Binaries
Visit [Duplo Releases](https://github.com/dlidstrom/Duplo/releases/latest) and download:
- Linux: `duplo-linux.zip`
- macOS: `duplo-macos.zip`
- Windows: `duplo-windows.zip`

Extract and ensure the binary is in your PATH.

## Usage

### Basic Usage
```bash
./executables/run-duplo/run-duplo.sh
```

### With Custom Settings
```bash
# Analyze with 30 line minimum
DUPLO_MIN_LINES=30 ./executables/run-duplo/run-duplo.sh

# Use specific thread count
DUPLO_THREADS=4 ./executables/run-duplo/run-duplo.sh

# Analyze only TypeScript files
DUPLO_EXTENSIONS=ts,tsx ./executables/run-duplo/run-duplo.sh
```

## Configuration

All settings are controlled via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DUPLO_MIN_LINES` | `20` | Minimum duplicate block length (lines) |
| `DUPLO_MIN_CHARS` | `3` | Minimum characters per line |
| `DUPLO_THREADS` | *auto* | Number of threads (auto-detects CPUs) |
| `DUPLO_EXTENSIONS` | `ts,tsx,js,jsx,html,css,scss` | File extensions to analyze |
| `DUPLO_IGNORE_PREPROCESSOR` | `true` | Ignore preprocessor directives |
| `DUPLO_IGNORE_SAME_NAME` | `false` | Ignore duplicates in same-named files |
| `DUPLO_OUTPUT_XML` | `true` | Generate XML report for CI/CD |
| `DUPLO_PERCENT_THRESHOLD` | *(none)* | Percentage similarity threshold |
| `DUPLO_MAX_FILES` | *(none)* | Maximum files to report |
| `DUPLO_EXCLUDE_DIRS` | *(none)* | Additional directories to exclude (comma-separated) |
| `REPORT_DIR` | `./reports/duplo` | Output directory for reports |

## Output Files

Reports are timestamped and stored in `reports/duplo/`:

1. **Text Report**: `duplo-report-YYYYMMDD-HHMMSS.txt`
   - Human-readable duplication report
   - Includes line numbers and file locations

2. **JSON Report**: `duplo-report-YYYYMMDD-HHMMSS.json`
   - Machine-readable format
   - Ideal for automation and CI/CD pipelines

3. **XML Report**: `duplo-report-YYYYMMDD-HHMMSS.xml`
   - Includes XSL stylesheet for browser viewing
   - Compatible with TeamCity, Jenkins, etc.

4. **Summary**: `duplo-summary-YYYYMMDD-HHMMSS.json`
   - Quick overview with file-level statistics
   - Includes duplicate counts per file

## CI/CD Integration

### Exit Codes
- `0`: No duplicates found (clean)
- `1`: Duplicates detected

### GitHub Actions Example
```yaml
- name: Check for duplicate code
  run: |
    DUPLO_MIN_LINES=25 ./executables/run-duplo/run-duplo.sh
  continue-on-error: true

- name: Upload Duplo Reports
  uses: actions/upload-artifact@v3
  with:
    name: duplo-reports
    path: reports/duplo/
```

### Jenkins Example
```groovy
stage('Duplicate Detection') {
  steps {
    sh 'DUPLO_MIN_LINES=25 ./executables/run-duplo/run-duplo.sh || true'
    publishHTML([
      reportDir: 'reports/duplo',
      reportFiles: 'duplo-report-*.xml',
      reportName: 'Duplo Report'
    ])
  }
}
```

## Performance

Duplo v2.0+ is extremely fast with multithreading:
- **~10,000 lines/second** single-threaded
- **Near-linear scaling** with additional cores
- Example: Quake 2 source (266 files, 102K lines) in ~9 seconds

## Interpreting Results

### What to Look For
1. **High duplicate counts** in specific files indicate refactoring opportunities
2. **Copy-paste patterns** across different modules suggest missing abstractions
3. **Test code duplicates** may indicate need for test utilities

### Recommended Actions
- **20-40 lines**: Consider extracting functions/methods
- **40-80 lines**: Strong candidate for refactoring
- **80+ lines**: High priority - extract to shared module

### False Positives
Some duplicates are acceptable:
- Test fixtures and setup code
- Auto-generated code
- Configuration templates
- Boilerplate patterns (e.g., similar API endpoints)

## Advanced Usage

### Analyzing Specific Directories
```bash
# Analyze only the api-gateway service
TARGET_DIR="$(pwd)/Apps/api-gateway" ./executables/run-duplo/run-duplo.sh
```

### Excluding Additional Directories
```bash
DUPLO_EXCLUDE_DIRS="test,__tests__,mocks" ./executables/run-duplo/run-duplo.sh
```

### Custom Duplo Arguments
```bash
DUPLO_EXTRA_ARGS="-pt 95 -d" ./executables/run-duplo/run-duplo.sh
```

## Troubleshooting

### Duplo Not Found
Ensure Duplo is installed and in your PATH:
```bash
which duplo
duplo --version
```

### Too Many/Few Duplicates
Adjust the minimum line threshold:
```bash
# More strict (fewer results)
DUPLO_MIN_LINES=40 ./run-duplo.sh

# More lenient (more results)
DUPLO_MIN_LINES=15 ./run-duplo.sh
```

### Performance Issues
Reduce thread count if system becomes unresponsive:
```bash
DUPLO_THREADS=2 ./run-duplo.sh
```

## References

- [Duplo GitHub Repository](https://github.com/dlidstrom/Duplo)
- [Duplo Release Downloads](https://github.com/dlidstrom/Duplo/releases)
- [Research Paper: Code Duplication Detection](http://scg.unibe.ch/archive/papers/Duca99bCodeDuplication.pdf)
- [Duplo Action for GitHub](https://github.com/dlidstrom/duplo-action)

## Version History

- **2025-12-25**: Updated to v2.0+ standards
  - Reduced default threshold to 20 lines (industry standard)
  - Added multi-threading support
  - Added XML output for CI/CD
  - Improved file filtering
  - Enhanced reporting
  - Added comprehensive documentation
