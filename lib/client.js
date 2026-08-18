window.__ModuleLoader__.load({
  id: "dsh-custom-reasoning",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    var React = require("react");

    var THINKING_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
    var THINKING_FORMATS = ['openai', 'deepseek', 'openrouter', 'together', 'zai', 'qwen', 'string-thinking', 'ant-ling'];
    var NS = 'llm-pi-ai';

    function Section(props) {
      var api = props.api;
      var serverState = React.useState(null);
      var serverConfig = serverState[0]; var setServerConfig = serverState[1];
      var localState = React.useState(null);
      var localConfig = localState[0]; var setLocalConfig = localState[1];
      var loadingState = React.useState(true);
      var loading = loadingState[0]; var setLoading = loadingState[1];
      var errorState = React.useState(null);
      var error = errorState[0]; var setError = errorState[1];
      var statusState = React.useState('');
      var status = statusState[0]; var setStatus = statusState[1];
      var dirtyState = React.useState(false);
      var dirty = dirtyState[0]; var setDirty = dirtyState[1];
      var copyModeState = React.useState('idle');
      var copyMode = copyModeState[0]; var setCopyMode = copyModeState[1];
      var copySourceState = React.useState(null);
      var copySource = copySourceState[0]; var setCopySource = copySourceState[1];

      var saveTimerRef = React.useRef(null);
      var dirtyRef = React.useRef(false);
      var serverRef = React.useRef(null);
      var localRef = React.useRef(null);
      var dragRef = React.useRef(null);
      var copyModeRef = React.useRef('idle');
      var copySourceRef = React.useRef(null);
      dirtyRef.current = dirty;
      serverRef.current = serverConfig;
      localRef.current = localConfig;
      copyModeRef.current = copyMode;
      copySourceRef.current = copySource;

      // Read settings from the API gateway
      var loadConfig = React.useCallback(function() {
        return api.settings.describe({}).then(function(res) {
          if (!res.result.ok) throw new Error(res.result.error.message);
          var descs = res.result.value && Array.isArray(res.result.value.namespaces) ? res.result.value.namespaces : [];
          var ns = descs.find(function(d) { return d.ns === NS; });
          var providers = (ns && ns.value && ns.value.providers) ? ns.value.providers : {};
          return { providers: providers, revision: ns ? ns.revision : 0 };
        });
      }, []);

      var doSave = React.useCallback(function() {
        var lc = localRef.current;
        var sc = serverRef.current;
        if (!lc || !sc) return;
        var changes = [];
        var sp = sc && sc.providers ? sc.providers : {};
        var providerKeys = Object.keys(lc.providers || {});
        for (var pi = 0; pi < providerKeys.length; pi++) {
          var p = providerKeys[pi];
          var lp = lc.providers[p];
          var spRoute = sp[p] || {};
          if (JSON.stringify(lp.compat) !== JSON.stringify(spRoute.compat)) {
            changes.push({ provider: p, compat: lp.compat || {} });
          }
          var models = lp.models || [];
          var spModels = spRoute.models || [];
          for (var mi = 0; mi < models.length; mi++) {
            var m = models[mi];
            var sm = spModels.find(function(x) { return x.id === m.id; }) || {};
            if (JSON.stringify(m.reasoningEfforts) !== JSON.stringify(sm.reasoningEfforts)) {
              changes.push({ provider: p, modelId: m.id, reasoningEfforts: m.reasoningEfforts });
            }
          }
        }
        if (changes.length === 0) { setDirty(false); return; }

        // Group by provider
        var byProvider = {};
        for (var i = 0; i < changes.length; i++) {
          var c = changes[i];
          if (!byProvider[c.provider]) byProvider[c.provider] = { models: {}, compat: null };
          if (c.modelId !== undefined) byProvider[c.provider].models[c.modelId] = c;
          if (c.compat !== undefined) byProvider[c.provider].compat = c.compat;
        }
        var ops = [];
        var bpKeys = Object.keys(byProvider);
        for (var bpi = 0; bpi < bpKeys.length; bpi++) {
          var provider = bpKeys[bpi];
          var group = byProvider[provider];
          if (group.compat !== null) {
            ops.push({ op: 'set', path: ['providers', provider, 'compat'], value: group.compat });
          }
          var mids = Object.keys(group.models);
          if (mids.length > 0) {
            var route = lc.providers[provider];
            var models = Array.isArray(route.models) ? route.models.map(function(m) {
              var copy = {}; var keys = Object.keys(m);
              for (var ki = 0; ki < keys.length; ki++) copy[keys[ki]] = m[keys[ki]];
              return copy;
            }) : [];
            for (var mj = 0; mj < mids.length; mj++) {
              var mid = mids[mj];
              var idx = models.findIndex(function(m) { return m.id === mid; });
              if (idx === -1) continue;
              if (group.models[mid].reasoningEfforts !== undefined) {
                models[idx].reasoningEfforts = group.models[mid].reasoningEfforts;
              }
            }
            ops.push({ op: 'set', path: ['providers', provider, 'models'], value: models });
          }
        }
        if (ops.length === 0) return;

        setStatus('saving');
        setError(null);
        return api.settings.mutate({ ns: NS, ops: ops, expectedRevision: sc.revision }).then(function(res) {
          if (!res.result.ok) throw new Error(res.result.error.message);
          setServerConfig(JSON.parse(JSON.stringify(lc)));
          setDirty(false);
          setStatus('saved');
        }).catch(function(e) {
          setError(String(e));
          setStatus('');
        });
      }, []);

      var doSaveRef = React.useRef(doSave);
      doSaveRef.current = doSave;

      var scheduleSave = React.useCallback(function() {
        if (saveTimerRef.current !== null) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
        saveTimerRef.current = setTimeout(function() {
          saveTimerRef.current = null;
          doSaveRef.current();
        }, 800);
      }, []);

      React.useEffect(function() {
        return function() {
          if (saveTimerRef.current !== null) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
          if (dirtyRef.current && doSaveRef.current) { doSaveRef.current(); }
        };
      }, []);

      React.useEffect(function() {
        loadConfig().then(function(c) {
          setServerConfig(c);
          setLocalConfig(JSON.parse(JSON.stringify(c)));
          setLoading(false);
        }).catch(function(e) {
          setError(String(e));
          setLoading(false);
        });
      }, [loadConfig]);

      React.useEffect(function() {
        var onUp = function() { dragRef.current = null; };
        var onKey = function(e) {
          if (e.key === 'Escape') { setCopyMode('idle'); setCopySource(null); }
        };
        window.addEventListener('mouseup', onUp);
        window.addEventListener('keydown', onKey);
        return function() {
          window.removeEventListener('mouseup', onUp);
          window.removeEventListener('keydown', onKey);
        };
      }, []);

      var providers = localConfig && localConfig.providers ? localConfig.providers : {};
      var entries = Object.entries(providers);

      var setLevel = function(provider, modelId, level, checked) {
        setLocalConfig(function(prev) {
          var next = JSON.parse(JSON.stringify(prev));
          var models = next.providers[provider].models || [];
          var model = models.find(function(m) { return m.id === modelId; });
          if (!model) return prev;
          var efforts = model.reasoningEfforts || {};
          if (checked) {
            efforts[level] = level === 'off' ? null : level;
          } else {
            if (Object.keys(efforts).length <= 1) return prev;
            delete efforts[level];
          }
          model.reasoningEfforts = Object.keys(efforts).length > 0 ? efforts : undefined;
          return next;
        });
        setDirty(true);
        setStatus('');
        setError(null);
        scheduleSave();
      };

      var pasteEfforts = function(provider, modelId, efforts) {
        setLocalConfig(function(prev) {
          var next = JSON.parse(JSON.stringify(prev));
          var models = next.providers[provider] && next.providers[provider].models;
          if (!models) return prev;
          var model = models.find(function(m) { return m.id === modelId; });
          if (!model) return prev;
          model.reasoningEfforts = efforts && Object.keys(efforts).length > 0 ? JSON.parse(JSON.stringify(efforts)) : undefined;
          return next;
        });
        setDirty(true);
        setStatus('');
        setError(null);
        scheduleSave();
      };

      var handleMouseDown = function(e, provider, modelId, level, checked) {
        var cm = copyModeRef.current;
        var cs = copySourceRef.current;

        if (cm === 'select-source') {
          e.preventDefault();
          var lc = localRef.current;
          var models = lc && lc.providers && lc.providers[provider] ? lc.providers[provider].models || [] : [];
          var m = models.find(function(x) { return x.id === modelId; });
          setCopySource({ provider: provider, modelId: modelId, efforts: m && m.reasoningEfforts ? m.reasoningEfforts : {} });
          setCopyMode('pasting');
          return;
        }

        if (cm === 'pasting' && cs) {
          e.preventDefault();
          if (cs.provider === provider && cs.modelId === modelId) return;
          dragRef.current = { mode: 'paste', pasted: {} };
          dragRef.current.pasted[modelId] = true;
          pasteEfforts(provider, modelId, cs.efforts);
          return;
        }

        e.preventDefault();
        var nextChecked = !checked;
        if (!nextChecked) {
          var lc2 = localRef.current;
          var models2 = lc2 && lc2.providers && lc2.providers[provider] ? lc2.providers[provider].models || [] : [];
          var m2 = models2.find(function(x) { return x.id === modelId; });
          var eff = m2 && m2.reasoningEfforts ? m2.reasoningEfforts : {};
          if (Object.keys(eff).length <= 1) return;
        }
        dragRef.current = { mode: nextChecked ? 'check' : 'uncheck', provider: provider, modelId: modelId, toggled: {} };
        dragRef.current.toggled[level] = true;
        setLevel(provider, modelId, level, nextChecked);
      };

      var handleMouseEnter = function(provider, modelId, level) {
        var drag = dragRef.current;
        if (drag === null) return;

        if (drag.mode === 'paste') {
          if (drag.pasted[modelId]) return;
          drag.pasted[modelId] = true;
          var cs = copySourceRef.current;
          if (cs && !(cs.provider === provider && cs.modelId === modelId)) {
            pasteEfforts(provider, modelId, cs.efforts);
          }
          return;
        }

        if (drag.provider !== provider || drag.modelId !== modelId) return;
        if (drag.toggled[level]) return;
        drag.toggled[level] = true;
        setLevel(provider, modelId, level, drag.mode === 'check');
      };

      var changeCompat = function(provider, thinkingFormat) {
        setLocalConfig(function(prev) {
          var next = JSON.parse(JSON.stringify(prev));
          var route = next.providers[provider];
          if (!route) return prev;
          route.compat = route.compat || {};
          route.compat.thinkingFormat = thinkingFormat || undefined;
          return next;
        });
        setDirty(true);
        setStatus('');
        setError(null);
        scheduleSave();
      };

      if (loading) {
        return React.createElement('div', { style: { padding: 20, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 } }, '加载中...');
      }

      if (entries.length === 0) {
        return React.createElement('div', { style: { padding: 20, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13, lineHeight: '22px' } },
          '没有自定义模型。请先在 ',
          React.createElement('b', null, 'Models'),
          ' 页面点击「添加自定义 Provider」创建模型，然后回到此页配置思考等级。'
        );
      }

      var sectionStyle = { maxWidth: 720, display: 'flex', flexDirection: 'column', gap: 20, padding: '0 0 40px 0' };
      var cardStyle = { border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--dsw-alias-bg-primary)' };
      var labelStyle = { fontSize: 13, color: 'var(--dsw-alias-label-secondary)', marginRight: 4 };
      var hintStyle = { margin: 0, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', lineHeight: '18px' };

      var copyBtnStyle = {
        padding: '6px 14px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2)',
        fontSize: 12, cursor: 'pointer',
        background: copyMode !== 'idle' ? 'var(--dsw-alias-interactive-bg-hover)' : 'var(--dsw-alias-bg-primary)',
        color: 'var(--dsw-alias-label-primary)'
      };

      var statusEl = null;
      if (status === 'saving') {
        statusEl = React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-state-warn-label)' } }, '保存中...');
      } else if (status === 'saved') {
        statusEl = React.createElement('span', { style: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' } }, '已保存');
      }

      var copyHint = null;
      if (copyMode === 'select-source') {
        copyHint = React.createElement('p', { style: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-state-warn-label)' } },
          '请点击一个模型的等级标签作为模板'
        );
      } else if (copyMode === 'pasting' && copySource) {
        copyHint = React.createElement('p', { style: { margin: 0, fontSize: 12, color: 'var(--dsw-alias-state-warn-label)' } },
          '点击或拖动到目标模型粘贴 ', copySource.provider, '/', copySource.modelId, ' 的等级配置（Esc 取消）'
        );
      }

      return React.createElement('div', { style: sectionStyle },
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          React.createElement('h2', { style: { margin: 0, fontSize: 16, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, '自定义模型思考等级'),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            statusEl,
            React.createElement('button', {
              style: copyBtnStyle,
              onClick: function() {
                if (copyMode !== 'idle') { setCopyMode('idle'); setCopySource(null); }
                else setCopyMode('select-source');
              }
            }, copyMode !== 'idle' ? '取消复制' : '复制配置')
          )
        ),
        React.createElement('p', { style: { margin: 0, fontSize: 13, color: 'var(--dsw-alias-label-tertiary)', lineHeight: '22px' } },
          '勾选模型支持的推理等级（可多选）。保存后，在对话中的模型选择器里会以',
          React.createElement('b', null, '单选'),
          '形式展示。修改后自动保存，可长按拖动快速多选。'
        ),
        copyHint,
        error !== null && React.createElement('div', { style: { color: 'var(--dsw-alias-state-error-primary)', fontSize: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--dsw-alias-interactive-bg-hover-danger)' } }, error),
        entries.map(function(entry) {
          var provider = entry[0]; var route = entry[1];
          var models = Array.isArray(route.models) ? route.models : [];
          var compat = route.compat || {};
          return React.createElement('div', { key: provider, style: cardStyle },
            React.createElement('div', { style: { fontSize: 14, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } }, provider),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('span', { style: labelStyle }, '思考格式:'),
              React.createElement('select', {
                value: compat.thinkingFormat || '',
                style: { fontSize: 13, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-primary)', color: 'var(--dsw-alias-label-primary)' },
                onChange: function(e) { changeCompat(provider, e.target.value || undefined); }
              },
                React.createElement('option', { value: '' }, '（自动检测）'),
                THINKING_FORMATS.map(function(f) { return React.createElement('option', { key: f, value: f }, f); })
              )
            ),
            models.length === 0
              ? React.createElement('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } }, '此 Provider 下没有模型')
              : models.map(function(model) {
                  var efforts = model.reasoningEfforts || {};
                  var isSource = copySource && copySource.provider === provider && copySource.modelId === model.id;
                  var modelCardStyle = {
                    display: 'flex', flexDirection: 'column', gap: 6,
                    padding: copyMode === 'pasting' ? 6 : 0,
                    borderRadius: 8,
                    background: isSource && copyMode === 'pasting' ? 'var(--dsw-alias-state-success-subtle)' : 'transparent',
                    border: isSource && copyMode === 'pasting' ? '1px solid var(--dsw-alias-state-success-primary)' : 'none'
                  };
                  return React.createElement('div', { key: model.id, style: modelCardStyle },
                    React.createElement('div', { style: { fontSize: 13, fontWeight: 500, color: 'var(--dsw-alias-label-primary)' } },
                      model.id,
                      isSource && copyMode === 'pasting' && React.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-state-success-primary)', marginLeft: 8 } }, '模板')
                    ),
                    React.createElement('p', { style: hintStyle }, '可用等级（可多选，在模型选择器中单选切换）：'),
                    React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 6, userSelect: 'none' } },
                      THINKING_LEVELS.map(function(level) {
                        var checked = level in efforts;
                        var cursorStyle = copyMode === 'select-source' ? 'copy' : copyMode === 'pasting' && !isSource ? 'cell' : 'pointer';
                        return React.createElement('label', {
                          key: level,
                          style: {
                            display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: cursorStyle,
                            padding: '4px 8px', borderRadius: 6,
                            background: checked ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
                            border: '1px solid ' + (checked ? 'var(--dsw-alias-border-l1)' : 'var(--dsw-alias-border-l3)'),
                            color: 'var(--dsw-alias-label-primary)',
                            userSelect: 'none'
                          },
                          onMouseDown: function(e) { handleMouseDown(e, provider, model.id, level, checked); },
                          onMouseEnter: function() { handleMouseEnter(provider, model.id, level); }
                        },
                          React.createElement('input', {
                            type: 'checkbox', checked: checked, style: { margin: 0, pointerEvents: 'none' },
                            readOnly: true
                          }),
                          level
                        );
                      })
                    )
                  );
                })
          );
        })
      );
    }

    function apply(ctx) {
      var slots = ctx.get('slots');
      if (slots === undefined) return;
      var connection = ctx.get('connection');
      if (connection === undefined) return;

      slots.inject('settings.section', function() {
        return slots.register(
          { name: 'settings.section', id: 'custom-reasoning', order: 12, label: '思考等级' },
          function(props) {
            return React.createElement(Section, { api: connection.api, close: props.close });
          }
        );
      });
    }

    exports.apply = apply;
    return module.exports;
  }
});