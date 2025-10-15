# Tartware PMS Documentation

This folder contains comprehensive documentation for the Tartware Property Management System, designed to be published via GitHub Pages.

## 📚 Documentation Structure

### Core Documentation

1. **[index.md](index.md)** - Main landing page with project overview
2. **[industry-standards.md](industry-standards.md)** - Detailed compliance with global PMS standards
3. **[database-architecture.md](database-architecture.md)** - Complete database design and schema
4. **[multi-tenancy.md](multi-tenancy.md)** - Multi-tenant architecture patterns

### Industry Standards Coverage

Our documentation demonstrates compliance with:

- ✅ **Oracle OPERA Cloud** - Used by Hyatt, Marriott (Global standard)
- ✅ **Cloudbeds Platform** - Leading North American PMS provider
- ✅ **Protel PMS** - European (DACH region) standard
- ✅ **RMS Cloud** - Asia-Pacific standard

## 🚀 Publishing to GitHub Pages

### Option 1: Automatic GitHub Pages (Recommended)

1. Push documentation to GitHub:
   ```bash
   git add docs/
   git commit -m "Add comprehensive documentation"
   git push origin main
   ```

2. Enable GitHub Pages:
   - Go to repository Settings
   - Navigate to "Pages" section
   - Source: Deploy from a branch
   - Branch: `main`
   - Folder: `/docs`
   - Save

3. Access your documentation:
   - URL: `https://red2n.github.io/tartware/`
   - GitHub will automatically build using Jekyll

### Option 2: Custom Domain

1. Add a `CNAME` file:
   ```bash
   echo "docs.tartware.com" > docs/CNAME
   ```

2. Configure DNS:
   - Add CNAME record: `docs.tartware.com` → `red2n.github.io`

3. Update repository settings to use custom domain

### Option 3: Manual Jekyll Build

```bash
cd docs/

# Install Jekyll (if not already installed)
gem install jekyll bundler

# Create Gemfile
cat > Gemfile << EOF
source 'https://rubygems.org'
gem 'github-pages', group: :jekyll_plugins
gem 'jekyll-seo-tag'
gem 'jekyll-sitemap'
EOF

# Install dependencies
bundle install

# Build site
bundle exec jekyll build

# Serve locally for testing
bundle exec jekyll serve
```

Visit `http://localhost:4000` to preview.

## 📖 Documentation Content

### Industry Standards (industry-standards.md)

**Comprehensive coverage of:**
- Global PMS provider comparisons
- Multi-tenant architecture patterns (real-world examples)
- Property management data models
- Reservation lifecycle standards
- Rate management strategies
- Payment processing compliance
- Analytics and KPI tracking
- Security and compliance (GDPR, PCI DSS, SOC 2)
- Channel management integration
- API design patterns

**Real-world examples:**
- Marriott International structure
- Hotel chain hierarchies
- Multi-property management
- Cross-tenant analytics

### Database Architecture (database-architecture.md)

**Complete technical reference:**
- Full schema documentation (22 tables)
- Entity relationship diagrams
- Multi-tenancy implementation
- Property management layer
- Rate and availability systems
- Reservation and guest management
- Financial transaction handling
- Analytics and reporting
- Operations (housekeeping, services)
- Performance optimization strategies
- Security features
- Scalability considerations
- Best practices and examples

### Multi-Tenancy Design (multi-tenancy.md)

**Enterprise patterns:**
- Multi-tenancy model comparisons
- Marriott International case study
- Tenant isolation strategies
- User management across tenants
- Role-based access control (RBAC)
- Tenant types and configurations
- Tenant lifecycle management
- Cross-tenant analytics
- Security best practices
- Troubleshooting guide

## 🎨 Customization

### Themes

The documentation uses the **Cayman** theme. To change:

```yaml
# docs/_config.yml
theme: jekyll-theme-minimal
# or: jekyll-theme-slate, jekyll-theme-architect, etc.
```

Available GitHub Pages themes:
- cayman (current)
- minimal
- slate
- architect
- midnight
- dinky
- time-machine
- leap-day
- tactile
- modernist
- hacker

### Navigation

Edit `_config.yml` to customize navigation:

```yaml
navigation:
  - title: Custom Page
    url: /custom-page
```

### SEO

Update metadata in `_config.yml`:

```yaml
title: Your Custom Title
description: Your description
google_analytics: UA-XXXXXXXXX-X
```

## 🔧 Local Development

### Prerequisites

- Ruby 2.7+
- Bundler

### Setup

```bash
cd docs/
bundle install
bundle exec jekyll serve --watch
```

### Live Reload

```bash
bundle exec jekyll serve --livereload
```

Changes to markdown files will automatically reload in browser.

## 📝 Adding New Pages

1. Create new markdown file in `docs/`:
   ```bash
   touch docs/new-page.md
   ```

2. Add frontmatter:
   ```markdown
   ---
   title: New Page Title
   description: Page description
   ---

   # New Page

   Content here...
   ```

3. Link from other pages:
   ```markdown
   [Link text](new-page.md)
   ```

## 🔍 Search

To add search functionality:

1. Add plugin to `_config.yml`:
   ```yaml
   plugins:
     - jekyll-lunr-js-search
   ```

2. Install:
   ```bash
   bundle add jekyll-lunr-js-search
   ```

## 📊 Analytics

### Google Analytics

1. Get tracking ID from Google Analytics
2. Update `_config.yml`:
   ```yaml
   google_analytics: UA-XXXXXXXXX-X
   ```

### Privacy Compliance

Add privacy policy link in footer or pages.

## 🛠️ Troubleshooting

### GitHub Pages not building

1. Check build status:
   - Repository → Actions tab
   - Look for Pages build deployment

2. Verify `_config.yml` syntax:
   ```bash
   bundle exec jekyll build --verbose
   ```

3. Check for unsupported plugins
   - GitHub Pages only supports specific Jekyll plugins

### Local build errors

```bash
# Clear Jekyll cache
bundle exec jekyll clean

# Rebuild
bundle exec jekyll build
```

### Styling issues

1. Check theme compatibility
2. Override with custom CSS:
   ```bash
   mkdir -p docs/assets/css
   touch docs/assets/css/style.scss
   ```

   ```scss
   ---
   ---
   @import "{{ site.theme }}";

   /* Custom styles */
   .page-header {
     background-color: #1e3a8a;
   }
   ```

## 📚 Additional Resources

### Jekyll Documentation
- [Jekyll Official Docs](https://jekyllrb.com/docs/)
- [GitHub Pages Docs](https://docs.github.com/en/pages)

### Markdown Reference
- [GitHub Flavored Markdown](https://guides.github.com/features/mastering-markdown/)
- [Markdown Cheatsheet](https://www.markdownguide.org/cheat-sheet/)

### SEO Optimization
- [Jekyll SEO Tag](https://github.com/jekyll/jekyll-seo-tag)
- [Sitemap Plugin](https://github.com/jekyll/jekyll-sitemap)

## 🤝 Contributing

To improve documentation:

1. Fork the repository
2. Create a feature branch
3. Make changes in `docs/` folder
4. Test locally with Jekyll
5. Submit pull request

## 📄 License

Documentation is licensed under the same terms as the Tartware PMS project.

---

**Maintained by**: Tartware Development Team
**Last Updated**: October 15, 2025
**Documentation Version**: 1.0.0
