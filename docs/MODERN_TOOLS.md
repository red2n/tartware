# Modern Tools for Tartware Setup

This project uses modern, faster alternatives to traditional Unix tools for better performance and developer experience.

## Tools Used

### 1. ripgrep (`rg`)
**Replacement for:** `grep`
**Performance:** 5-10x faster than grep
**Benefits:**
- Automatically respects `.gitignore`
- Skips binary files and hidden files by default
- Better regex support with PCRE2
- Colored output by default

**Installation:**
```bash
# Ubuntu/Debian
sudo apt install ripgrep

# macOS
brew install ripgrep

# Other platforms
# See: https://github.com/BurntSushi/ripgrep#installation
```

**Usage in setup script:**
- Counting CREATE TABLE statements
- Counting CREATE INDEX statements
- Counting FOREIGN KEY constraints
- Counting CREATE TYPE (ENUMs)

### 2. fd (`fd` or `fdfind`)
**Replacement for:** `find`
**Performance:** 5-10x faster than find
**Benefits:**
- Simple, intuitive syntax
- Parallel file tree walking
- Respects `.gitignore` by default
- Smart case-insensitive search
- Colored output

**Installation:**
```bash
# Ubuntu/Debian (installs as 'fdfind')
sudo apt install fd-find

# macOS
brew install fd

# Other platforms
# See: https://github.com/sharkdp/fd#installation
```

**Note:** On Ubuntu/Debian, the binary is named `fdfind` to avoid conflicts with another package. Our setup script handles both names automatically.

**Usage in setup script:**
- Fast file searching (when needed)
- Directory traversal
- Pattern matching

## Fallback Support

The `setup-database.sh` script automatically detects which tools are available:

```bash
# Tool detection
✓ Using ripgrep for faster searching
✓ Using fd (fdfind) for faster file searching
```

If modern tools are not installed, the script falls back to traditional commands:
- `ripgrep` → `grep`
- `fd` → `find`

## Performance Comparison

### File Searching
```bash
# Traditional (grep)
time grep -r "CREATE TABLE" scripts/tables/

# Modern (ripgrep)
time rg "CREATE TABLE" scripts/tables/
```

**Result:** ripgrep is typically 5-10x faster, especially in large codebases.

### File Finding
```bash
# Traditional (find)
time find scripts/ -name "*.sql"

# Modern (fd)
time fd ".sql" scripts/
```

**Result:** fd is typically 5-10x faster with cleaner syntax.

## Quick Install (All Tools)

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y ripgrep fd-find

# macOS
brew install ripgrep fd

# Verify installation
rg --version
fd --version  # or fdfind --version on Ubuntu
```

## Why These Tools?

1. **Speed:** Both tools are written in Rust and highly optimized
2. **Smart Defaults:** Automatically skip irrelevant files (.git, node_modules, etc.)
3. **Better UX:** Cleaner output, better error messages
4. **Active Development:** Regularly updated with new features
5. **Industry Standard:** Widely used in modern development workflows

## References

- ripgrep: https://github.com/BurntSushi/ripgrep
- fd: https://github.com/sharkdp/fd
- Performance benchmarks: https://blog.burntsushi.net/ripgrep/

## Current Usage in Tartware

### setup-database.sh
- ✅ Uses `rg` for counting database objects in SQL scripts
- ✅ Falls back to `grep` if `rg` not available
- ✅ Detects both `fd` and `fdfind` commands
- ✅ Provides installation hints when tools are missing

### Performance Impact
With modern tools installed:
- Expected count calculation: **~50ms** (vs 300ms with grep)
- Overall setup time improvement: **~5-10%**
- Better terminal output with colors and formatting
