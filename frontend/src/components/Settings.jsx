import { useState, useEffect } from 'react';
import { api } from '../api';
import './Settings.css';

const SEARCH_PROVIDERS = [
  {
    id: 'duckduckgo',
    name: 'DuckDuckGo',
    description: 'News search. Fast and free.',
    requiresKey: false,
    keyType: null,
  },
  {
    id: 'tavily',
    name: 'Tavily',
    description: 'Purpose-built for LLMs. Returns rich, relevant content. Requires API key.',
    requiresKey: true,
    keyType: 'tavily',
  },
  {
    id: 'brave',
    name: 'Brave Search',
    description: 'Privacy-focused search. 2,000 free queries/month. Requires API key.',
    requiresKey: true,
    keyType: 'brave',
  },
];

const DIRECT_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', key: 'openai_api_key' },
  { id: 'anthropic', name: 'Anthropic', key: 'anthropic_api_key' },
  { id: 'google', name: 'Google', key: 'google_api_key' },
  { id: 'mistral', name: 'Mistral', key: 'mistral_api_key' },
  { id: 'deepseek', name: 'DeepSeek', key: 'deepseek_api_key' },
];

export default function Settings({ onClose, ollamaStatus, onRefreshOllama }) {
  const [settings, setSettings] = useState(null);
  const [selectedSearchProvider, setSelectedSearchProvider] = useState('duckduckgo');
  const [fullContentResults, setFullContentResults] = useState(3);

  // OpenRouter State
  const [openrouterApiKey, setOpenrouterApiKey] = useState('');
  const [availableModels, setAvailableModels] = useState([]);
  const [isTestingOpenRouter, setIsTestingOpenRouter] = useState(false);
  const [openrouterTestResult, setOpenrouterTestResult] = useState(null);

  // Ollama State
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434');
  const [ollamaAvailableModels, setOllamaAvailableModels] = useState([]);
  const [isTestingOllama, setIsTestingOllama] = useState(false);
  const [ollamaTestResult, setOllamaTestResult] = useState(null);

  // Direct Provider State
  const [directKeys, setDirectKeys] = useState({
    openai_api_key: '',
    anthropic_api_key: '',
    google_api_key: '',
    mistral_api_key: '',
    deepseek_api_key: ''
  });
  const [directAvailableModels, setDirectAvailableModels] = useState([]);

  // Validation State
  const [validatingKeys, setValidatingKeys] = useState({});
  const [keyValidationStatus, setKeyValidationStatus] = useState({});

  // Search API Keys
  const [tavilyApiKey, setTavilyApiKey] = useState('');
  const [braveApiKey, setBraveApiKey] = useState('');
  const [isTestingTavily, setIsTestingTavily] = useState(false);
  const [isTestingBrave, setIsTestingBrave] = useState(false);
  const [tavilyTestResult, setTavilyTestResult] = useState(null);
  const [braveTestResult, setBraveTestResult] = useState(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Enabled Providers (which sources are available)
  const [enabledProviders, setEnabledProviders] = useState({
    openrouter: true,
    ollama: false,
    direct: false  // Master toggle for all direct connections
  });

  // Individual direct provider toggles
  const [directProviderToggles, setDirectProviderToggles] = useState({
    openai: false,
    anthropic: false,
    google: false,
    mistral: false,
    deepseek: false
  });

  // Council Configuration (unified across all providers)
  const [councilModels, setCouncilModels] = useState([]);
  const [chairmanModel, setChairmanModel] = useState('');

  // Web Search Query Generator
  const [searchQueryModel, setSearchQueryModel] = useState('');

  // System Prompts State
  const [prompts, setPrompts] = useState({
    stage1_prompt: '',
    stage2_prompt: '',
    stage3_prompt: '',
    title_prompt: '',
    search_query_prompt: ''
  });
  const [activePromptTab, setActivePromptTab] = useState('stage1');

  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Remote/Local filter toggles per model type
  const [searchQueryFilter, setSearchQueryFilter] = useState('remote');  // 'remote' or 'local'
  const [councilMemberFilters, setCouncilMemberFilters] = useState({});  // Per-member filters (indexed by member index)
  const [chairmanFilter, setChairmanFilter] = useState('remote');

  useEffect(() => {
    loadSettings();
  }, []);

  // Check for changes
  useEffect(() => {
    if (!settings) return;

    const checkChanges = () => {
      if (selectedSearchProvider !== settings.search_provider) return true;
      if (fullContentResults !== (settings.full_content_results ?? 3)) return true;

      // Enabled Providers
      if (JSON.stringify(enabledProviders) !== JSON.stringify(settings.enabled_providers)) return true;
      if (JSON.stringify(directProviderToggles) !== JSON.stringify(settings.direct_provider_toggles)) return true;

      // Council Configuration (unified)
      if (JSON.stringify(councilModels) !== JSON.stringify(settings.council_models)) return true;
      if (chairmanModel !== settings.chairman_model) return true;

      // Web Search Query Generator
      if (searchQueryModel !== settings.search_query_model) return true;

      // Prompts
      if (prompts.stage1_prompt !== settings.stage1_prompt) return true;
      if (prompts.stage2_prompt !== settings.stage2_prompt) return true;
      if (prompts.stage3_prompt !== settings.stage3_prompt) return true;
      if (prompts.search_query_prompt !== settings.search_query_prompt) return true;

      // Note: API keys are auto-saved on test, so we don't check them here

      return false;
    };

    setHasChanges(checkChanges());
  }, [
    settings,
    selectedSearchProvider,
    fullContentResults,
    enabledProviders,
    directProviderToggles,
    councilModels,
    chairmanModel,
    searchQueryModel,
    prompts
  ]);

  const loadSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);

      setSelectedSearchProvider(data.search_provider || 'duckduckgo');
      setFullContentResults(data.full_content_results ?? 3);

      // Enabled Providers - auto-enable any configured providers
      const hasDirectConfigured = !!(data.openai_api_key_set || data.anthropic_api_key_set ||
        data.google_api_key_set || data.mistral_api_key_set || data.deepseek_api_key_set);

      setEnabledProviders({
        openrouter: !!data.openrouter_api_key_set || (!hasDirectConfigured && !ollamaStatus?.connected),
        ollama: ollamaStatus?.connected || false,
        direct: hasDirectConfigured
      });

      // Individual direct provider toggles
      setDirectProviderToggles({
        openai: !!data.openai_api_key_set,
        anthropic: !!data.anthropic_api_key_set,
        google: !!data.google_api_key_set,
        mistral: !!data.mistral_api_key_set,
        deepseek: !!data.deepseek_api_key_set
      });

      // Council Configuration (unified)
      setCouncilModels(data.council_models || []);
      setChairmanModel(data.chairman_model || '');

      // Web Search Query Generator
      setSearchQueryModel(data.search_query_model || 'google/gemini-2.5-flash');

      // Ollama Settings
      setOllamaBaseUrl(data.ollama_base_url || 'http://localhost:11434');

      // Prompts
      setPrompts({
        stage1_prompt: data.stage1_prompt || '',
        stage2_prompt: data.stage2_prompt || '',
        stage3_prompt: data.stage3_prompt || '',
        search_query_prompt: data.search_query_prompt || ''
      });

      // Clear Direct Keys (for security)
      setDirectKeys({
        openai_api_key: '',
        anthropic_api_key: '',
        google_api_key: '',
        mistral_api_key: '',
        deepseek_api_key: ''
      });

      // Load available models from all sources
      loadModels();
      loadOllamaModels(data.ollama_base_url || 'http://localhost:11434');

    } catch (err) {
      setError('Failed to load settings');
    }
  };

  const loadModels = async () => {
    setIsLoadingModels(true);
    try {
      const data = await api.getModels();
      if (data.models && data.models.length > 0) {
        // Sort models alphabetically
        const sorted = data.models.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setAvailableModels(sorted);
      }

      // Fetch direct models from backend
      try {
        const directModels = await api.getDirectModels();
        setDirectAvailableModels(directModels);
      } catch (error) {
        console.error('Failed to fetch direct models:', error);
        // Fallback to empty list or basic models if fetch fails
        setDirectAvailableModels([]);
      }

    } catch (err) {
      console.warn('Failed to load models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const loadOllamaModels = async (baseUrl) => {
    try {
      const data = await api.getOllamaModels(baseUrl);
      if (data.models && data.models.length > 0) {
        // Sort models alphabetically
        const sorted = data.models.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setOllamaAvailableModels(sorted);
      }
    } catch (err) {
      console.warn('Failed to load Ollama models:', err);
    }
  };


  const handleTestTavily = async () => {
    if (!tavilyApiKey) {
      setTavilyTestResult({ success: false, message: 'Please enter an API key first' });
      return;
    }
    setIsTestingTavily(true);
    setTavilyTestResult(null);
    try {
      const result = await api.testTavilyKey(tavilyApiKey);
      setTavilyTestResult(result);

      // Auto-save API key if validation succeeds
      if (result.success) {
        await api.updateSettings({ tavily_api_key: tavilyApiKey });
        setTavilyApiKey(''); // Clear input after save

        // Reload settings
        await loadSettings();

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setTavilyTestResult({ success: false, message: 'Test failed' });
    } finally {
      setIsTestingTavily(false);
    }
  };

  const handleTestBrave = async () => {
    if (!braveApiKey) {
      setBraveTestResult({ success: false, message: 'Please enter an API key first' });
      return;
    }
    setIsTestingBrave(true);
    setBraveTestResult(null);
    try {
      const result = await api.testBraveKey(braveApiKey);
      setBraveTestResult(result);

      // Auto-save API key if validation succeeds
      if (result.success) {
        await api.updateSettings({ brave_api_key: braveApiKey });
        setBraveApiKey(''); // Clear input after save

        // Reload settings
        await loadSettings();

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setBraveTestResult({ success: false, message: 'Test failed' });
    } finally {
      setIsTestingBrave(false);
    }
  };

  const handleTestOpenRouter = async () => {
    if (!openrouterApiKey && !settings.openrouter_api_key_set) {
      setOpenrouterTestResult({ success: false, message: 'Please enter an API key first' });
      return;
    }
    setIsTestingOpenRouter(true);
    setOpenrouterTestResult(null);
    try {
      // If input is empty but key is configured, pass null to test the saved key
      const keyToTest = openrouterApiKey || null;
      const result = await api.testOpenRouterKey(keyToTest);
      setOpenrouterTestResult(result);

      // Auto-save API key if validation succeeds and a new key was provided
      if (result.success && openrouterApiKey) {
        await api.updateSettings({ openrouter_api_key: openrouterApiKey });
        setOpenrouterApiKey(''); // Clear input after save

        // Reload settings
        await loadSettings();

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setOpenrouterTestResult({ success: false, message: 'Test failed' });
    } finally {
      setIsTestingOpenRouter(false);
    }
  };

  const handleTestOllama = async () => {
    setIsTestingOllama(true);
    setOllamaTestResult(null);
    try {
      const result = await api.testOllamaConnection(ollamaBaseUrl);
      setOllamaTestResult(result);

      // Always refresh parent component's ollama status (success or failure)
      if (onRefreshOllama) {
        onRefreshOllama(ollamaBaseUrl);
      }

      if (result.success) {
        // Auto-save base URL if connection succeeds
        await api.updateSettings({ ollama_base_url: ollamaBaseUrl });

        // Reload settings
        await loadSettings();

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setOllamaTestResult({ success: false, message: 'Connection failed' });

      // Refresh parent status on exception too
      if (onRefreshOllama) {
        onRefreshOllama(ollamaBaseUrl);
      }
    } finally {
      setIsTestingOllama(false);
    }
  };

  const handleCouncilModelChange = (index, modelId) => {
    setCouncilModels(prev => {
      const updated = [...prev];
      updated[index] = modelId;
      return updated;
    });
  };

  const getMemberFilter = (index) => {
    return councilMemberFilters[index] || 'remote';
  };

  const handleMemberFilterChange = (index, filter) => {
    setCouncilMemberFilters(prev => ({
      ...prev,
      [index]: filter
    }));

    // Clear the model selection for this member when switching filters
    setCouncilModels(prev => {
      const updated = [...prev];
      updated[index] = '';
      return updated;
    });
  };

  const handleAddCouncilMember = () => {
    const newIndex = councilModels.length;
    const filter = getMemberFilter(newIndex);
    const filtered = filterByRemoteLocal(getFilteredAvailableModels(), filter);
    if (filtered.length > 0) {
      setCouncilModels(prev => [...prev, filtered[0].id]);
      // Initialize filter for new member
      setCouncilMemberFilters(prev => ({
        ...prev,
        [newIndex]: 'remote'
      }));
    }
  };

  const handleRemoveCouncilMember = (index) => {
    setCouncilModels(prev => prev.filter((_, i) => i !== index));
    // Clean up filters - shift indices down
    setCouncilMemberFilters(prev => {
      const newFilters = {};
      Object.keys(prev).forEach(key => {
        const idx = parseInt(key);
        if (idx < index) {
          newFilters[idx] = prev[idx];
        } else if (idx > index) {
          newFilters[idx - 1] = prev[idx];
        }
      });
      return newFilters;
    });
  };

  const handlePromptChange = (key, value) => {
    setPrompts(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleResetPrompt = async (key) => {
    try {
      const defaults = await api.getDefaultSettings();
      if (defaults[key]) {
        handlePromptChange(key, defaults[key]);
      }
    } catch (err) {
      console.error("Failed to fetch default prompt", err);
    }
  };

  const handleResetToDefaults = () => {
    setShowResetConfirm(true);
  };

  const confirmResetToDefaults = async () => {
    setShowResetConfirm(false);

    try {
      const defaults = await api.getDefaultSettings();

      // General Settings
      setSelectedSearchProvider('duckduckgo');
      setFullContentResults(3);
      setShowFreeOnly(false);

      // Council Configuration (unified)
      setCouncilModels(defaults.council_models);
      setChairmanModel(defaults.chairman_model);

      // Ollama Base URL
      setOllamaBaseUrl('http://localhost:11434');

      // Web Search Query Generator
      setSearchQueryModel(defaults.search_query_model);

      // Prompts
      setPrompts({
        stage1_prompt: defaults.stage1_prompt,
        stage2_prompt: defaults.stage2_prompt,
        stage3_prompt: defaults.stage3_prompt,
        search_query_prompt: defaults.search_query_prompt
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to load default settings');
    }
  };

  const handleTestDirectKey = async (providerId, keyField) => {
    const apiKey = directKeys[keyField];
    if (!apiKey) return;

    setValidatingKeys(prev => ({ ...prev, [providerId]: true }));
    setKeyValidationStatus(prev => ({ ...prev, [providerId]: null }));

    try {
      const result = await api.testProviderKey(providerId, apiKey);
      setKeyValidationStatus(prev => ({
        ...prev,
        [providerId]: {
          success: result.success,
          message: result.message
        }
      }));

      // Auto-save API key if validation succeeds
      if (result.success) {
        await api.updateSettings({ [keyField]: apiKey });
        setDirectKeys(prev => ({ ...prev, [keyField]: '' })); // Clear input after save

        // Reload settings
        await loadSettings();

        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      setKeyValidationStatus(prev => ({
        ...prev,
        [providerId]: {
          success: false,
          message: err.message
        }
      }));
    } finally {
      setValidatingKeys(prev => ({ ...prev, [providerId]: false }));
    }
  };



  const handleExportCouncil = () => {
    const config = {
      // General
      search_provider: selectedSearchProvider,
      full_content_results: fullContentResults,
      show_free_only: showFreeOnly,

      // Enabled Providers
      enabled_providers: enabledProviders,

      // Council Configuration (unified)
      council_models: councilModels,
      chairman_model: chairmanModel,

      // Ollama Base URL
      ollama_base_url: ollamaBaseUrl,

      // Web Search Query Generator
      search_query_model: searchQueryModel,

      // Prompts
      prompts: prompts
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "council_config.json");
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportCouncil = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const config = JSON.parse(e.target.result);

        // Apply General Settings
        if (config.search_provider) setSelectedSearchProvider(config.search_provider);
        if (config.full_content_results !== undefined) setFullContentResults(config.full_content_results);
        if (config.show_free_only !== undefined) setShowFreeOnly(config.show_free_only);

        // Apply Enabled Providers
        if (config.enabled_providers) {
          setEnabledProviders(config.enabled_providers);
        }

        // Apply Council Configuration (unified)
        if (config.council_models) setCouncilModels(config.council_models);
        if (config.chairman_model) setChairmanModel(config.chairman_model);

        // Apply Ollama Base URL
        if (config.ollama_base_url) setOllamaBaseUrl(config.ollama_base_url);

        // Apply Web Search Query Generator
        if (config.search_query_model) setSearchQueryModel(config.search_query_model);

        // Apply Prompts
        if (config.prompts) {
          setPrompts(prev => ({ ...prev, ...config.prompts }));
        }

        // Validate imported models against all available models
        const allModels = getAllAvailableModels();
        const missingModels = (config.council_models || []).filter(id =>
          !allModels.find(m => m.id === id)
        );

        if (missingModels.length > 0) {
          setError(`Imported with warnings: Models not found: ${missingModels.join(', ')}`);
        } else {
          setSuccess(true);
          setTimeout(() => setSuccess(false), 3000);
        }

      } catch (err) {
        setError(`Import failed: ${err.message}`);
      }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const updates = {
        search_provider: selectedSearchProvider,
        full_content_results: fullContentResults,

        // Enabled Providers
        enabled_providers: enabledProviders,
        direct_provider_toggles: directProviderToggles,

        // Council Configuration (unified)
        council_models: councilModels,
        chairman_model: chairmanModel,

        // Web Search Query Generator
        search_query_model: searchQueryModel,

        // Prompts
        ...prompts
      };

      // Only send API keys if they've been changed
      if (tavilyApiKey && !tavilyApiKey.startsWith('•')) {
        updates.tavily_api_key = tavilyApiKey;
      }
      if (braveApiKey && !braveApiKey.startsWith('•')) {
        updates.brave_api_key = braveApiKey;
      }
      if (openrouterApiKey && !openrouterApiKey.startsWith('•')) {
        updates.openrouter_api_key = openrouterApiKey;
      }

      // Add Direct Provider Keys
      Object.entries(directKeys).forEach(([key, value]) => {
        if (value && !value.startsWith('•')) {
          updates[key] = value;
        }
      });

      await api.updateSettings(updates);
      setSuccess(true);
      setTavilyApiKey('');
      setBraveApiKey('');
      setOpenrouterApiKey('');

      await loadSettings();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper function to check if a direct provider is configured
  const isDirectProviderConfigured = (providerName) => {
    switch (providerName) {
      case 'OpenAI': return !!(directKeys.openai_api_key || settings?.openai_api_key_set);
      case 'Anthropic': return !!(directKeys.anthropic_api_key || settings?.anthropic_api_key_set);
      case 'Google': return !!(directKeys.google_api_key || settings?.google_api_key_set);
      case 'Mistral': return !!(directKeys.mistral_api_key || settings?.mistral_api_key_set);
      case 'DeepSeek': return !!(directKeys.deepseek_api_key || settings?.deepseek_api_key_set);
      default: return false;
    }
  };

  // Get all available models from all sources
  const getAllAvailableModels = () => {
    const models = [];

    // Add OpenRouter models if enabled
    if (enabledProviders.openrouter) {
      models.push(...availableModels);
    }

    // Add Ollama models if enabled
    if (enabledProviders.ollama) {
      models.push(...ollamaAvailableModels.map(m => ({
        ...m,
        id: `ollama:${m.id}`,
        name: `${m.name || m.id} (Local)`
      })));
    }

    // Add direct provider models if master toggle is enabled AND individual provider is enabled
    if (enabledProviders.direct) {
      const filteredDirectModels = directAvailableModels.filter(m => {
        const providerKey = m.provider.toLowerCase();
        const individualToggleEnabled = directProviderToggles[providerKey];
        const providerConfigured = isDirectProviderConfigured(m.provider);
        return individualToggleEnabled && providerConfigured;
      });
      models.push(...filteredDirectModels);
    }

    // Deduplicate by model ID (prefer direct connections over OpenRouter for same model)
    // Since direct models are added last, always set to overwrite earlier entries
    const uniqueModels = new Map();
    models.forEach(model => {
      uniqueModels.set(model.id, model);
    });

    return Array.from(uniqueModels.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  // Get filtered models for council member selection (respects free filter)
  const getFilteredAvailableModels = () => {
    const all = getAllAvailableModels();
    if (!showFreeOnly) return all;

    // Filter to free models, but keep Ollama models (they're always "free")
    return all.filter(m => m.is_free || m.id.startsWith('ollama:'));
  };

  // Get models available for chairman (paid models only, unless it's Ollama)
  const getChairmanModels = () => {
    const all = getAllAvailableModels();
    // Chairman should be a paid/premium model (or local Ollama)
    return all.filter(m => !m.is_free || m.id.startsWith('ollama:'));
  };

  // Filter models by remote/local for specific use case
  const filterByRemoteLocal = (models, filter) => {
    if (filter === 'local') {
      // Only Ollama models
      return models.filter(m => m.id.startsWith('ollama:'));
    } else {
      // Remote: OpenRouter + Direct providers (exclude Ollama)
      return models.filter(m => !m.id.startsWith('ollama:'));
    }
  };

  if (!settings) {
    return (
      <div className="settings-overlay">
        <div className="settings-modal">
          <div className="settings-loading">Loading settings...</div>
        </div>
      </div>
    );
  }

  const selectedProviderInfo = SEARCH_PROVIDERS.find(p => p.id === selectedSearchProvider);

  const renderModelOptions = (models) => {
    // Group models by provider
    const grouped = models.reduce((acc, model) => {
      // Determine provider
      let provider = model.provider || 'OpenRouter';
      if (model.id.startsWith('ollama:')) provider = 'Local (Ollama)';
      else if (model.id.startsWith('openai:')) provider = 'OpenAI';
      else if (model.id.startsWith('anthropic:')) provider = 'Anthropic';
      else if (model.id.startsWith('google:')) provider = 'Google';
      else if (model.id.startsWith('mistral:')) provider = 'Mistral';
      else if (model.id.startsWith('deepseek:')) provider = 'DeepSeek';
      else if (model.id.startsWith('x-ai:')) provider = 'xAI';
      else if (model.id.startsWith('meta-llama:')) provider = 'Meta Llama';

      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(model);
      return acc;
    }, {});

    // Sort providers
    const providerOrder = ['Google', 'Anthropic', 'OpenAI', 'Mistral', 'DeepSeek', 'xAI', 'Meta Llama', 'Local (Ollama)', 'OpenRouter'];
    const sortedProviders = Object.keys(grouped).sort((a, b) => {
      const indexA = providerOrder.indexOf(a);
      const indexB = providerOrder.indexOf(b);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });

    return sortedProviders.map(provider => (
      <optgroup key={provider} label={provider}>
        {grouped[provider].map(model => (
          <option key={model.id} value={model.id}>
            {model.name}
          </option>
        ))}
      </optgroup>
    ));
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>

        <div className="settings-content">

          {/* API Keys Configuration */}
          <section className="settings-section">
            <h3>API Keys</h3>
            <p className="section-description">
              Configure your API keys for different LLM providers and services.
            </p>

            {/* OpenRouter */}
            <div className="api-key-section">
              <label>OpenRouter API Key</label>
              <div className="api-key-input-row">
                <input
                  type="password"
                  placeholder={settings?.openrouter_api_key_set ? '••••••••••••••••' : 'Enter API key'}
                  value={openrouterApiKey}
                  onChange={(e) => {
                    setOpenrouterApiKey(e.target.value);
                    setOpenrouterTestResult(null);
                  }}
                  className={settings?.openrouter_api_key_set && !openrouterApiKey ? 'key-configured' : ''}
                />
                <button
                  className="test-button"
                  onClick={handleTestOpenRouter}
                  disabled={!openrouterApiKey && !settings?.openrouter_api_key_set || isTestingOpenRouter}
                >
                  {isTestingOpenRouter ? 'Testing...' : (settings?.openrouter_api_key_set && !openrouterApiKey ? 'Retest' : 'Test')}
                </button>
              </div>
              {settings?.openrouter_api_key_set && !openrouterApiKey && (
                <div className="key-status set">✓ API key configured</div>
              )}
              {openrouterTestResult && (
                <div className={`test-result ${openrouterTestResult.success ? 'success' : 'error'}`}>
                  {openrouterTestResult.message}
                </div>
              )}
              <p className="api-key-hint">
                Get your key from <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">openrouter.ai</a>
              </p>
            </div>

            {/* Ollama */}
            <div className="api-key-section">
              <label>Ollama Base URL</label>
              <div className="api-key-input-row">
                <input
                  type="text"
                  placeholder="http://localhost:11434"
                  value={ollamaBaseUrl}
                  onChange={(e) => {
                    setOllamaBaseUrl(e.target.value);
                    setOllamaTestResult(null);
                  }}
                />
                <button
                  className="test-button"
                  onClick={handleTestOllama}
                  disabled={!ollamaBaseUrl || isTestingOllama}
                >
                  {isTestingOllama ? 'Testing...' : 'Connect'}
                </button>
              </div>
              {ollamaTestResult && (
                <div className={`test-result ${ollamaTestResult.success ? 'success' : 'error'}`}>
                  {ollamaTestResult.message}
                </div>
              )}
              {ollamaStatus && ollamaStatus.connected && (
                <div className="ollama-auto-status connected">
                  <span className="status-indicator connected">●</span>
                  <span className="status-text">
                    <strong>Connected to Ollama</strong> <span className="status-separator">·</span> <span className="status-time">Last checked: {new Date(ollamaStatus.lastConnected).toLocaleString()}</span>
                  </span>
                </div>
              )}
              {ollamaStatus && !ollamaStatus.connected && !ollamaStatus.testing && (
                <div className="ollama-auto-status">
                  <span className="status-indicator disconnected">●</span>
                  <span className="status-text">Not connected</span>
                </div>
              )}
              <p className="api-key-hint">
                Default is http://localhost:11434
              </p>
              <div className="model-options-row" style={{ marginTop: '12px' }}>
                <button
                  type="button"
                  className="reset-defaults-button"
                  onClick={() => loadOllamaModels(ollamaBaseUrl)}
                >
                  Refresh Local Models
                </button>
                {ollamaAvailableModels.length === 0 && enabledProviders.ollama && (
                  <span className="error-text">No local models found. Check connection.</span>
                )}
              </div>
            </div>

            {/* Direct LLM API Connections */}
            <div className="subsection" style={{ marginTop: '24px' }}>
              <h4>Direct LLM API Connections</h4>
              <p className="section-description" style={{ marginBottom: '12px' }}>
                Connect directly to LLM providers using your own API keys.
              </p>

              {DIRECT_PROVIDERS.map(dp => (
                <div key={dp.id} className="api-key-section">
                  <label>{dp.name} API Key</label>
                  <div className="api-key-input-row">
                    <input
                      type="password"
                      placeholder={settings?.[`${dp.key}_set`] ? '••••••••••••••••' : 'Enter API key'}
                      value={directKeys[dp.key]}
                      onChange={e => setDirectKeys(prev => ({ ...prev, [dp.key]: e.target.value }))}
                      className={settings?.[`${dp.key}_set`] && !directKeys[dp.key] ? 'key-configured' : ''}
                    />
                    <button
                      className="test-button"
                      onClick={() => handleTestDirectKey(dp.id, dp.key)}
                      disabled={(!directKeys[dp.key] && !settings?.[`${dp.key}_set`]) || validatingKeys[dp.id]}
                    >
                      {validatingKeys[dp.id] ? 'Testing...' : (settings?.[`${dp.key}_set`] && !directKeys[dp.key] ? 'Retest' : 'Test')}
                    </button>
                  </div>
                  {settings?.[`${dp.key}_set`] && !directKeys[dp.key] && (
                    <div className="key-status set">✓ API key configured</div>
                  )}
                  {keyValidationStatus[dp.id] && (
                    <div className={`test-result ${keyValidationStatus[dp.id].success ? 'success' : 'error'}`}>
                      {keyValidationStatus[dp.id].message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Available Model Sources */}
          <section className="settings-section">
            <h3>Available Model Sources</h3>
            <p className="section-description">
              Toggle which providers are available for the search generator, council members, and chairman. Configure API keys above before enabling.
            </p>

            <div className="hybrid-settings-card">
              {/* Primary Sources */}
              <div className="filter-group">
                <label className="toggle-wrapper">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={enabledProviders.openrouter}
                      onChange={(e) => setEnabledProviders(prev => ({ ...prev, openrouter: e.target.checked }))}
                    />
                    <span className="slider"></span>
                  </div>
                  <span className="toggle-text">OpenRouter (Cloud)</span>
                </label>

                <label className="toggle-wrapper">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={enabledProviders.ollama}
                      onChange={(e) => setEnabledProviders(prev => ({ ...prev, ollama: e.target.checked }))}
                    />
                    <span className="slider"></span>
                  </div>
                  <span className="toggle-text">Local (Ollama)</span>
                </label>
              </div>

              <div className="filter-divider"></div>

              {/* Direct Connections Master Toggle */}
              <div className="filter-group" style={{ marginBottom: enabledProviders.direct ? '16px' : '0' }}>
                <label className="toggle-wrapper">
                  <div className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={enabledProviders.direct}
                      onChange={(e) => setEnabledProviders(prev => ({ ...prev, direct: e.target.checked }))}
                    />
                    <span className="slider"></span>
                  </div>
                  <span className="toggle-text">Direct Connections</span>
                </label>
              </div>

              {/* Individual Direct Provider Toggles (purple) */}
              {enabledProviders.direct && (
                <div className="direct-grid">
                  {DIRECT_PROVIDERS.map(dp => (
                    <label key={dp.id} className="toggle-wrapper">
                      <div className="toggle-switch direct-toggle">
                        <input
                          type="checkbox"
                          checked={directProviderToggles[dp.id]}
                          onChange={(e) => setDirectProviderToggles(prev => ({ ...prev, [dp.id]: e.target.checked }))}
                        />
                        <span className="slider"></span>
                      </div>
                      <span className="toggle-text" style={{ fontSize: '13px' }}>
                        {dp.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* Web Search Query Generator */}
          <section className="settings-section">
            <h3>Web Search Query Generator</h3>
            <p className="section-description">
              Select a model to generate optimized search queries from user questions.
            </p>

            <div className="council-member-row">
              <span className="member-label">Search Query Model</span>
              <div className="model-type-toggle">
                <button
                  type="button"
                  className={`type-btn ${searchQueryFilter === 'remote' ? 'active' : ''}`}
                  onClick={() => {
                    setSearchQueryFilter('remote');
                    setSearchQueryModel('');
                  }}
                >
                  Remote
                </button>
                <button
                  type="button"
                  className={`type-btn ${searchQueryFilter === 'local' ? 'active' : ''}`}
                  onClick={() => {
                    setSearchQueryFilter('local');
                    setSearchQueryModel('');
                  }}
                  disabled={!enabledProviders.ollama || ollamaAvailableModels.length === 0}
                  title={!enabledProviders.ollama || ollamaAvailableModels.length === 0 ? 'Enable and connect Ollama first' : ''}
                >
                  Local
                </button>
              </div>
              <select
                value={searchQueryModel}
                onChange={(e) => setSearchQueryModel(e.target.value)}
                className="model-select"
              >
                <option value="">Select a model</option>
                {renderModelOptions(filterByRemoteLocal(getAllAvailableModels(), searchQueryFilter))}
              </select>
            </div>
          </section>

          {/* Council Configuration */}
          <section className="settings-section">
            <h3>Council Configuration</h3>

            <div className="model-options-row">
              <label className="free-filter-label">
                <input
                  type="checkbox"
                  checked={showFreeOnly}
                  onChange={e => setShowFreeOnly(e.target.checked)}
                />
                Show free OpenRouter models only
              </label>
              {isLoadingModels && <span className="loading-models">Loading models...</span>}
            </div>

            {/* Council Members */}
            <div className="subsection" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0 }}>Council Members</h4>
              </div>
              <div className="council-members">
                {councilModels.map((modelId, index) => {
                  const memberFilter = getMemberFilter(index);
                  return (
                    <div key={index} className="council-member-row">
                      <span className="member-label">Member {index + 1}</span>
                      <div className="model-type-toggle">
                        <button
                          type="button"
                          className={`type-btn ${memberFilter === 'remote' ? 'active' : ''}`}
                          onClick={() => handleMemberFilterChange(index, 'remote')}
                        >
                          Remote
                        </button>
                        <button
                          type="button"
                          className={`type-btn ${memberFilter === 'local' ? 'active' : ''}`}
                          onClick={() => handleMemberFilterChange(index, 'local')}
                          disabled={!enabledProviders.ollama || ollamaAvailableModels.length === 0}
                          title={!enabledProviders.ollama || ollamaAvailableModels.length === 0 ? 'Enable and connect Ollama first' : ''}
                        >
                          Local
                        </button>
                      </div>
                      <select
                        value={modelId}
                        onChange={e => handleCouncilModelChange(index, e.target.value)}
                        className="model-select"
                      >
                        {renderModelOptions(filterByRemoteLocal(getFilteredAvailableModels(), memberFilter))}
                        {/* Keep current selection visible even if filtered out */}
                        {!filterByRemoteLocal(getFilteredAvailableModels(), memberFilter).find(m => m.id === modelId) && (
                          <option value={modelId}>
                            {getAllAvailableModels().find(m => m.id === modelId)?.name || modelId}
                          </option>
                        )}
                      </select>
                      <button
                        type="button"
                        className="remove-member-button"
                        onClick={() => handleRemoveCouncilMember(index)}
                        disabled={councilModels.length <= 2}
                        title="Remove member"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                className="add-member-button"
                onClick={handleAddCouncilMember}
                disabled={getFilteredAvailableModels().length === 0 || councilModels.length >= 8}
              >
                + Add Council Member
              </button>
              <p className="section-description" style={{ marginTop: '8px', marginBottom: '0' }}>
                You can add up to 8 council members. With 6 or more members, requests are processed in batches to avoid rate limits.
              </p>
              {councilModels.length >= 6 && (
                <div className="council-size-warning">
                  ⚠️ <strong>6+ members:</strong> To avoid rate limits, we'll process requests in batches of 3. Max 8 members allowed.
                </div>
              )}
              {councilModels.length >= 8 && (
                <div className="council-size-info">
                  ✓ Maximum council size (8 members) reached
                </div>
              )}
            </div>

            {/* Chairman */}
            <div className="subsection" style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0 }}>Chairman Model</h4>
                <div className="model-type-toggle">
                  <button
                    type="button"
                    className={`type-btn ${chairmanFilter === 'remote' ? 'active' : ''}`}
                    onClick={() => {
                      setChairmanFilter('remote');
                      setChairmanModel('');
                    }}
                  >
                    Remote
                  </button>
                  <button
                    type="button"
                    className={`type-btn ${chairmanFilter === 'local' ? 'active' : ''}`}
                    onClick={() => {
                      setChairmanFilter('local');
                      setChairmanModel('');
                    }}
                    disabled={!enabledProviders.ollama || ollamaAvailableModels.length === 0}
                    title={!enabledProviders.ollama || ollamaAvailableModels.length === 0 ? 'Enable and connect Ollama first' : ''}
                  >
                    Local
                  </button>
                </div>
              </div>
              <div className="chairman-selection">
                <select
                  value={chairmanModel}
                  onChange={(e) => setChairmanModel(e.target.value)}
                  className="model-select"
                >
                  <option value="">Select a model</option>
                  {renderModelOptions(filterByRemoteLocal(getChairmanModels(), chairmanFilter))}
                </select>
              </div>
            </div>

            {/* Import / Export Configuration */}
            <div className="subsection" style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
              <h4 style={{ margin: '0 0 4px 0' }}>Import / Export Configuration</h4>
              <p className="section-description" style={{ marginBottom: '12px' }}>
                Save your current setup (models, providers, prompts) to a file or load a previous configuration.
                Useful for switching between different testing scenarios.
              </p>
              <div className="council-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="file"
                  id="import-council"
                  style={{ display: 'none' }}
                  accept=".json"
                  onChange={handleImportCouncil}
                />
                <button
                  className="action-btn"
                  onClick={() => document.getElementById('import-council').click()}
                  title="Import Configuration"
                >
                  Import
                </button>
                <button
                  className="action-btn"
                  onClick={handleExportCouncil}
                  title="Export Configuration"
                >
                  Export
                </button>
              </div>
            </div>
          </section>

          {/* System Prompts Section */}
          <section className="settings-section">
            <h3>System Prompts</h3>
            <p className="section-description">
              Customize the system instructions for each stage of the council process.
            </p>

            <div className="prompts-tabs">
              <button
                className={`prompt-tab ${activePromptTab === 'search' ? 'active' : ''}`}
                onClick={() => setActivePromptTab('search')}
              >
                Search Query
              </button>
              <button
                className={`prompt-tab ${activePromptTab === 'stage1' ? 'active' : ''}`}
                onClick={() => setActivePromptTab('stage1')}
              >
                Stage 1
              </button>
              <button
                className={`prompt-tab ${activePromptTab === 'stage2' ? 'active' : ''}`}
                onClick={() => setActivePromptTab('stage2')}
              >
                Stage 2
              </button>
              <button
                className={`prompt-tab ${activePromptTab === 'stage3' ? 'active' : ''}`}
                onClick={() => setActivePromptTab('stage3')}
              >
                Stage 3
              </button>
            </div>

            <div className="prompt-editor">
              {activePromptTab === 'search' && (
                <div className="prompt-content">
                  <label>Search Query Generation</label>
                  <p className="section-description" style={{ marginBottom: '10px' }}>
                    Generates optimized search terms from user questions for web search.
                  </p>
                  <p className="prompt-help">Variables: <code>{'{user_query}'}</code></p>
                  <textarea
                    value={prompts.search_query_prompt}
                    onChange={(e) => handlePromptChange('search_query_prompt', e.target.value)}
                    rows={5}
                  />
                  <button className="reset-prompt-btn" onClick={() => handleResetPrompt('search_query_prompt')}>Reset to Default</button>
                </div>
              )}
              {activePromptTab === 'stage1' && (
                <div className="prompt-content">
                  <label>Stage 1: Initial Response</label>
                  <p className="section-description" style={{ marginBottom: '10px' }}>
                    Guides council members' initial responses to user questions.
                  </p>
                  <p className="prompt-help">Variables: <code>{'{user_query}'}</code>, <code>{'{search_context_block}'}</code></p>
                  <textarea
                    value={prompts.stage1_prompt}
                    onChange={(e) => handlePromptChange('stage1_prompt', e.target.value)}
                    rows={10}
                  />
                  <button className="reset-prompt-btn" onClick={() => handleResetPrompt('stage1_prompt')}>Reset to Default</button>
                </div>
              )}
              {activePromptTab === 'stage2' && (
                <div className="prompt-content">
                  <label>Stage 2: Peer Ranking</label>
                  <p className="section-description" style={{ marginBottom: '10px' }}>
                    Instructs models how to rank and evaluate peer responses.
                  </p>
                  <p className="prompt-help">Variables: <code>{'{user_query}'}</code>, <code>{'{responses_text}'}</code>, <code>{'{search_context_block}'}</code></p>
                  <textarea
                    value={prompts.stage2_prompt}
                    onChange={(e) => handlePromptChange('stage2_prompt', e.target.value)}
                    rows={10}
                  />
                  <button className="reset-prompt-btn" onClick={() => handleResetPrompt('stage2_prompt')}>Reset to Default</button>
                </div>
              )}
              {activePromptTab === 'stage3' && (
                <div className="prompt-content">
                  <label>Stage 3: Chairman Synthesis</label>
                  <p className="section-description" style={{ marginBottom: '10px' }}>
                    Directs the chairman to synthesize a final answer from all inputs.
                  </p>
                  <p className="prompt-help">Variables: <code>{'{user_query}'}</code>, <code>{'{stage1_text}'}</code>, <code>{'{stage2_text}'}</code>, <code>{'{search_context_block}'}</code></p>
                  <textarea
                    value={prompts.stage3_prompt}
                    onChange={(e) => handlePromptChange('stage3_prompt', e.target.value)}
                    rows={10}
                  />
                  <button className="reset-prompt-btn" onClick={() => handleResetPrompt('stage3_prompt')}>Reset to Default</button>
                </div>
              )}
            </div>
          </section>

          {/* Web Search Config */}
          <section className="settings-section">
            <h3>Web Search Provider</h3>
            <div className="provider-options">
              {SEARCH_PROVIDERS.map(provider => (
                <div key={provider.id} className={`provider-option-container ${selectedSearchProvider === provider.id ? 'selected' : ''}`}>
                  <label
                    className="provider-option"
                  >
                    <input
                      type="radio"
                      name="search_provider"
                      value={provider.id}
                      checked={selectedSearchProvider === provider.id}
                      onChange={() => setSelectedSearchProvider(provider.id)}
                    />
                    <div className="provider-info">
                      <span className="provider-name">{provider.name}</span>
                      <span className="provider-description">{provider.description}</span>
                    </div>
                  </label>

                  {/* Inline API Key Input for Tavily */}
                  {selectedSearchProvider === 'tavily' && provider.id === 'tavily' && (
                    <div className="inline-api-key-section">
                      <div className="api-key-input-row">
                        <input
                          type="password"
                          placeholder={settings.tavily_api_key_set ? '••••••••••••••••' : 'Enter Tavily API key'}
                          value={tavilyApiKey}
                          onChange={e => {
                            setTavilyApiKey(e.target.value);
                            setTavilyTestResult(null);
                          }}
                          className={settings.tavily_api_key_set && !tavilyApiKey ? 'key-configured' : ''}
                        />
                        <button
                          type="button"
                          className="test-button"
                          onClick={handleTestTavily}
                          disabled={isTestingTavily || (!tavilyApiKey && !settings.tavily_api_key_set)}
                        >
                          {isTestingTavily ? 'Testing...' : (settings.tavily_api_key_set && !tavilyApiKey ? 'Retest' : 'Test')}
                        </button>
                      </div>
                      {settings.tavily_api_key_set && !tavilyApiKey && (
                        <div className="key-status set">✓ API key configured</div>
                      )}
                      {tavilyTestResult && (
                        <div className={`test-result ${tavilyTestResult.success ? 'success' : 'error'}`}>
                          {tavilyTestResult.success ? '✓' : '✗'} {tavilyTestResult.message}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inline API Key Input for Brave */}
                  {selectedSearchProvider === 'brave' && provider.id === 'brave' && (
                    <div className="inline-api-key-section">
                      <div className="api-key-input-row">
                        <input
                          type="password"
                          placeholder={settings.brave_api_key_set ? '••••••••••••••••' : 'Enter Brave API key'}
                          value={braveApiKey}
                          onChange={e => {
                            setBraveApiKey(e.target.value);
                            setBraveTestResult(null);
                          }}
                          className={settings.brave_api_key_set && !braveApiKey ? 'key-configured' : ''}
                        />
                        <button
                          type="button"
                          className="test-button"
                          onClick={handleTestBrave}
                          disabled={isTestingBrave || (!braveApiKey && !settings.brave_api_key_set)}
                        >
                          {isTestingBrave ? 'Testing...' : (settings.brave_api_key_set && !braveApiKey ? 'Retest' : 'Test')}
                        </button>
                      </div>
                      {settings.brave_api_key_set && !braveApiKey && (
                        <div className="key-status set">✓ API key configured</div>
                      )}
                      {braveTestResult && (
                        <div className={`test-result ${braveTestResult.success ? 'success' : 'error'}`}>
                          {braveTestResult.success ? '✓' : '✗'} {braveTestResult.message}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="full-content-section">
              <label>Full Article Fetch (Jina AI)</label>
              <p className="setting-description">
                Uses Jina AI to read the full text of the top search results. This gives the Council deeper context than just search snippets. Applies to all search providers. <strong>Set to 0 to disable.</strong>
              </p>
              <div className="full-content-input-row">
                <input
                  type="range"
                  min="0"
                  max="5"
                  value={fullContentResults}
                  onChange={e => setFullContentResults(parseInt(e.target.value, 10))}
                  className="full-content-slider"
                />
                <span className="full-content-value">{fullContentResults} results</span>
              </div>
            </div>
          </section>

        </div>

        <div className="settings-footer">
          {error && <div className="settings-error">{error}</div>}
          {success && <div className="settings-success">Settings saved!</div>}
          <button className="reset-button" type="button" onClick={handleResetToDefaults}>
            Reset to Defaults
          </button>
          <div className="footer-actions">
            <button className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="save-button"
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
            >
              {isSaving ? 'Saving...' : (success ? 'Saved!' : 'Save')}
            </button>
          </div>
        </div>
      </div >
      {showResetConfirm && (
        <div className="settings-overlay confirmation-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="settings-modal confirmation-modal" onClick={e => e.stopPropagation()}>
            <div className="settings-header">
              <h2>Confirm Reset</h2>
            </div>
            <div className="settings-content confirmation-content">
              <p>Are you sure you want to reset to defaults?</p>
              <div className="confirmation-details">
                <p><strong>This will reset:</strong></p>
                <ul>
                  <li>All model selections</li>
                  <li>System prompts</li>
                  <li>Utility models</li>
                  <li>General settings</li>
                </ul>
                <p className="confirmation-safe">✓ API keys will be PRESERVED</p>
              </div>
            </div>
            <div className="settings-footer">
              <div className="footer-actions" style={{ width: '100%', justifyContent: 'flex-end' }}>
                <button className="cancel-button" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                <button className="reset-button" onClick={confirmResetToDefaults}>Confirm Reset</button>
              </div>
            </div>
          </div>
        </div>
      )
      }
    </div >
  );
}