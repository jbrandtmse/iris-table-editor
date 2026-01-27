# IRIS Table Editor

> **🚧 UNDER HEAVY CONSTRUCTION 🚧**
>
> This project is in active development and not yet ready for production use.

A VS Code extension that provides Excel-like grid editing for InterSystems IRIS database tables directly within VS Code.

## Features (Planned)

- Browse and select IRIS database tables
- View table data in an Excel-like grid interface
- Edit cells inline with automatic save
- Insert new rows
- Delete rows with confirmation
- Pagination for large datasets
- Dark and light theme support

## Technical Overview

- Connects via Atelier REST API (HTTP-based, no superserver port required)
- Integrates with InterSystems Server Manager for connection management
- Uses VS Code Webview API with vscode-webview-ui-toolkit

## Requirements

- VS Code 1.85.0 or higher
- [InterSystems Server Manager](https://marketplace.visualstudio.com/items?itemName=intersystems-community.servermanager) extension
- Access to an InterSystems IRIS instance (2021.1+)

## Installation

*Coming soon - extension not yet published to marketplace*

## Development

```bash
# Install dependencies
npm install

# Build the extension
npm run compile

# Watch mode for development
npm run watch

# Package for distribution
npm run package
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
