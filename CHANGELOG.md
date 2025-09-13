# [1.1.0](https://github.com/yujeongJeon/mermaid-mcp/compare/v1.0.0...v1.1.0) (2025-09-13)


### Bug Fixes

* Enhance property analysis to handle arrow functions as methods ([75301ac](https://github.com/yujeongJeon/mermaid-mcp/commit/75301ac6552c0884bc1b5906c239388fcc2f2ba8))


### Features

* Add AgentFactory for creating diagram agents based on LLM provider ([1dde501](https://github.com/yujeongJeon/mermaid-mcp/commit/1dde5017c13981a1e4ebfafd1308c18e5ccce93c))
* Add class diagram prompt generation for English and Korean languages ([96ab48d](https://github.com/yujeongJeon/mermaid-mcp/commit/96ab48d494a823da317f0f797e6f0e3bd4526a8a))
* Add DIAGRAM_GENERATION_TOOL for generating mermaid class diagrams with summaries ([674b066](https://github.com/yujeongJeon/mermaid-mcp/commit/674b0661451f72906714526551c86b7a0b3ea1a1))
* Add Git utility functions and refactor project creation logic ([fd0fd88](https://github.com/yujeongJeon/mermaid-mcp/commit/fd0fd88ab6bf71de494a3ea6abd3ce09f819d1e3))
* Add semantic release configuration and dependencies for automated versioning ([637f002](https://github.com/yujeongJeon/mermaid-mcp/commit/637f0021578c2c5c264b3f9d641e779f58c2d40f))
* Consolidate tool registration logic into a dedicated ToolRegistry class ([adbb6f0](https://github.com/yujeongJeon/mermaid-mcp/commit/adbb6f0d16ce387b254be6f870f05f69a7140a79))
* Implement AnthropicAgent class for API interaction with diagram generation tool ([1d5d651](https://github.com/yujeongJeon/mermaid-mcp/commit/1d5d6510d560d942d5ea9c9f3b09a5410ec0b8e5))
* Implement BaseAgent class for diagram generation with user prompt construction ([9106e15](https://github.com/yujeongJeon/mermaid-mcp/commit/9106e15ead6faf7c9c0ab6160a7c69d393671d17))
* Implement class caching for improved analysis performance ([ce2fb3c](https://github.com/yujeongJeon/mermaid-mcp/commit/ce2fb3c12dc4d24fb5d7edc9f3df724de0d2264f))
* Implement class file scanning and target class finder ([6502d17](https://github.com/yujeongJeon/mermaid-mcp/commit/6502d1746ac2581f2cd70022c2aa9a8faea4ae6c))
* Implement OpenAIAgent class for API interaction with diagram generation tool ([c09f9ac](https://github.com/yujeongJeon/mermaid-mcp/commit/c09f9ac642ad0a7ec80e496223733ccf1ef9a117))
* Refactor LLM integration by removing direct API calls and using AgentFactory for diagram generation ([17b3f3d](https://github.com/yujeongJeon/mermaid-mcp/commit/17b3f3dedcc8a3e3580f93e662576820ea996eaa))
* Supplement project root retrieval to check for Git installation and adjust path handling ([76e33ee](https://github.com/yujeongJeon/mermaid-mcp/commit/76e33ee43ae4389493e79dcacd34c66e2e75ca2c))
