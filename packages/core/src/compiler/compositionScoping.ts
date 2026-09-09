import postcss, { type AtRule, type Node, type Rule } from "postcss";

const AUTHORED_ROOT_ID_ATTR = "data-sc-authored-id";
const INNER_ROOT_ATTR = "data-sc-inner-root";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeCssAttributeValue(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function escapeCssIdentifier(value: string): string {
  if (!value) return value;
  const escaped = value.replace(/[^a-zA-Z0-9_-]/g, (char) => `\\${char}`);
  return escaped.replace(/^-?\d/, (match) => `\\${match}`);
}

function getAuthoredRootIdSelectorForms(authoredRootId: string): string[] {
  const trimmed = authoredRootId.trim();
  if (!trimmed) return [];
  return Array.from(new Set([trimmed, escapeCssIdentifier(trimmed)])).filter(Boolean);
}

function isSelectorNameChar(char: string | undefined): boolean {
  return !!char && /[\w-]/.test(char);
}

function replaceAuthoredRootIdSelectors(
  selector: string,
  authoredRootId: string,
  replacement: string,
): string {
  const forms = getAuthoredRootIdSelectorForms(authoredRootId).sort((a, b) => b.length - a.length);
  if (forms.length === 0) return selector;

  let result = "";
  let bracketDepth = 0;
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < selector.length; index += 1) {
    const char = selector[index];
    const previousChar = index > 0 ? selector[index - 1] : "";

    if (quote) {
      result += char;
      if (char === quote && previousChar !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      result += char;
      continue;
    }

    if (char === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      result += char;
      continue;
    }

    if (char === "#" && bracketDepth === 0) {
      const matchedForm = forms.find((form) => selector.startsWith(form, index + 1));
      if (matchedForm) {
        const nextChar = selector[index + 1 + matchedForm.length];
        if (!isSelectorNameChar(nextChar)) {
          result += replacement;
          index += matchedForm.length;
          continue;
        }
      }
    }

    result += char;
  }

  return result;
}

function normalizeAuthoredRootIdSelector(selector: string, authoredRootId?: string | null): string {
  const trimmed = authoredRootId?.trim();
  if (!trimmed) return selector;
  return replaceAuthoredRootIdSelectors(
    selector,
    trimmed,
    `[${AUTHORED_ROOT_ID_ATTR}="${escapeCssAttributeValue(trimmed)}"]`,
  );
}

/** The composition's own box: the host when it renders content directly, or the
 *  flattened inner root when one is preserved below the host. Used both for a
 *  bare composition-root selector and for remapped document-level selectors.
 *  Relies on `:has()` (Chrome 105 / Safari 15.4 / Firefox 121) — an existing
 *  baseline for the bare-root case, noted here for new callers. */
function compositionBoxSelector(scope: string): string {
  return `${scope}:not(:has([${INNER_ROOT_ATTR}])), ${scope} > [${INNER_ROOT_ATTR}]`;
}

function scopeSelector(
  selector: string,
  scope: string,
  compositionId: string,
  authoredRootId?: string | null,
  compoundAuthoredRoot?: boolean,
  scopeRootSelectors?: boolean,
): string {
  const selectorWithoutAuthoredRootId = normalizeAuthoredRootIdSelector(selector, authoredRootId);
  const selectorWithoutRootTiming = normalizeCompositionRootSelector(
    selectorWithoutAuthoredRootId,
    scope,
    compositionId,
  );
  const trimmed = selectorWithoutRootTiming.trim();
  if (!trimmed) return selector;
  if (trimmed === "*") return selector;
  if (/^(html|body|:root)$/i.test(trimmed)) {
    // A mounted/inlined sub-comp's document-level selectors must not style the
    // PARENT (a sub-comp `body { width/height/overflow }` would clobber the host
    // <body> and clip the preview/render). Remap to the comp's own box. A
    // top-level compile (scopeRootSelectors falsy) legitimately owns the document.
    //
    // Coverage is intentionally BARE-only: compound forms (`body.dark`,
    // `body[data-theme]`, `body:hover`, `html body`, `:root .x`) fall through to
    // general scoping below. That is byte-identical to pre-fix behavior — those
    // selectors never matched the parent <body> (it has no data-composition-id),
    // so there was no clobber to fix. The bare forms are the ones that actually
    // caused the parent-body clobber, which is what this remap targets.
    return scopeRootSelectors ? compositionBoxSelector(scope) : selector;
  }
  // Authored-root patterns must follow the renamed instance, not require a nested root.
  const compositionIdPattern = new RegExp(
    `\\[\\s*data-composition-id\\s*[\\^\\*\\$]?=\\s*(["'])${escapeRegExp(compositionId)}\\1\\s*\\]`,
    "g",
  );
  if (compositionIdPattern.test(trimmed)) {
    const isRootBoxSelector = trimmed.replace(compositionIdPattern, "").trim() === "";
    if (isRootBoxSelector) {
      // A bare root selector styles the composition's own box (flex/grid/
      // position/padding). When flattenInnerRoot preserves the authored root
      // as a wrapper below `scope` (see prepareFlattenedInnerRoot), that
      // wrapper is the element real children are laid out in, not `scope`
      // itself, so the box styling must land there instead. It must land on
      // exactly one of the two: applying it to both compounds any additive
      // property (padding, margin, non-zero transform) since the wrapper
      // sits nested inside the host and would inherit the effect twice.
      return compositionBoxSelector(scope);
    }
    return selectorWithoutRootTiming.replace(compositionIdPattern, scope);
  }
  const leading = selectorWithoutRootTiming.match(/^\s*/)?.[0] ?? "";
  const trailing = selectorWithoutRootTiming.match(/\s*$/)?.[0] ?? "";
  if (compoundAuthoredRoot) {
    const authoredRootAttr = authoredRootId
      ? `[${AUTHORED_ROOT_ID_ATTR}="${escapeCssAttributeValue(authoredRootId)}"]`
      : null;
    if (authoredRootAttr && trimmed.startsWith(authoredRootAttr)) {
      const rest = trimmed.slice(authoredRootAttr.length);
      return `${leading}${scope}${authoredRootAttr}${rest}${trailing}`;
    }
  }
  return `${leading}${scope} ${trimmed}${trailing}`;
}

function normalizeCompositionRootSelector(
  selector: string,
  scope: string,
  compositionId: string,
): string {
  const quotedCompId = escapeRegExp(compositionId);
  const compAttr = String.raw`\[\s*data-composition-id\s*=\s*(?:"${quotedCompId}"|'${quotedCompId}')\s*\]`;
  const timingAttr = String.raw`\s*\[\s*data-(?:start|duration)\s*=\s*(?:"[^"]*"|'[^']*')\s*\]`;
  return selector
    .replace(new RegExp(`${compAttr}(?:${timingAttr})+`, "g"), scope)
    .replace(new RegExp(`(?:${timingAttr})+${compAttr}`, "g"), scope);
}

const GLOBAL_AT_RULES = new Set(["keyframes", "-webkit-keyframes", "font-face"]);

function isAtRuleNode(node: Node["parent"]): node is AtRule {
  return node?.type === "atrule";
}

function isInsideGlobalAtRule(rule: Rule): boolean {
  let current: Node["parent"] = rule.parent;
  while (current) {
    if (isAtRuleNode(current) && GLOBAL_AT_RULES.has(current.name.toLowerCase())) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * A Rule nested inside another Rule (CSS Nesting Module Level 1) already
 * inherits scope from its parent's `&` prefix at match time — re-applying
 * the composition scope to the nested selector produces
 * `<scope> <scope> .child`, which matches nothing when the composition
 * root only appears once in the DOM. Only top-level rules get scoped;
 * their nested descendants inherit the scope naturally via CSS nesting.
 * See #2721 for the reproducer that motivated this.
 */
function isNestedInsideAnotherRule(rule: Rule): boolean {
  let current: Node["parent"] = rule.parent;
  while (current) {
    if (current.type === "rule") return true;
    current = current.parent;
  }
  return false;
}

export function scopeCssToComposition(
  css: string,
  compositionId: string,
  scopeSelectorOverride?: string,
  authoredRootId?: string | null,
  options?: { compoundAuthoredRoot?: boolean; scopeRootSelectors?: boolean },
): string {
  const trimmedCompositionId = compositionId.trim();
  if (!css || !trimmedCompositionId) return css;
  const scope =
    scopeSelectorOverride ||
    `[data-composition-id="${escapeCssAttributeValue(trimmedCompositionId)}"]`;
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch {
    return "";
  }

  root.walkRules((rule) => {
    if (isInsideGlobalAtRule(rule)) return;
    if (isNestedInsideAnotherRule(rule)) return;
    rule.selectors = rule.selectors.map((selector) =>
      scopeSelector(
        selector,
        scope,
        trimmedCompositionId,
        authoredRootId,
        options?.compoundAuthoredRoot,
        options?.scopeRootSelectors,
      ),
    );
  });

  return root.toResult({ map: false }).css;
}

/**
 * Serialize a value as a JS literal safe to emit inside a `<script>` element.
 *
 * `<script>` is a RAW TEXT element: HTML serialization does not escape its
 * content, and the tokenizer ends the element at the first `</script` — in any
 * string, comment or regex context. `JSON.stringify` escapes `"` and `\` but
 * neither `<` nor `/`, so any dynamic literal carrying `</script>` would close
 * the element early and have the remainder parsed as markup. Rewriting every
 * `<` to `<` removes the only byte that can start a closing tag, and is
 * transparent to both `JSON.parse` and the JS string grammar, so the value the
 * runtime reads is unchanged.
 *
 * Every dynamic literal in an emitted script body must go through here: a
 * per-value guard on this surface has already been missed once, since the
 * composition id reaches the emitted script through four separate literals.
 */
function jsonScriptLiteral(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function wrapScopedCompositionScript(
  source: string,
  compositionId: string,
  errorLabel = "[SmashCut] composition script error:",
  scopeSelectorOverride?: string,
  timelineCompositionId = compositionId,
  authoredRootId?: string | null,
): string {
  const compositionIdLiteral = jsonScriptLiteral(compositionId);
  const timelineCompositionIdLiteral = jsonScriptLiteral(timelineCompositionId);
  const errorLabelLiteral = jsonScriptLiteral(errorLabel);
  const escapedCompositionId = escapeRegExp(compositionId);
  const authoredRootIdLiteral = jsonScriptLiteral(authoredRootId?.trim() || null);
  const scopeSelectorLiteral = jsonScriptLiteral(scopeSelectorOverride ?? null);
  const rootSelectorPatternLiteral = jsonScriptLiteral(
    String.raw`\[\s*data-composition-id\s*=\s*(?:"${escapedCompositionId}"|'${escapedCompositionId}')\s*\]`,
  );
  const timingSelectorPatternLiteral = jsonScriptLiteral(
    String.raw`\s*\[\s*data-(?:start|duration)\s*=\s*(?:"[^"]*"|'[^']*')\s*\]`,
  );
  const authoredRootIdFormsLiteral = jsonScriptLiteral(
    getAuthoredRootIdSelectorForms(authoredRootId?.trim() || ""),
  );
  return `(function(){
  var __scCompId = ${compositionIdLiteral};
  var __scTimelineCompId = ${timelineCompositionIdLiteral};
  var __scErrorLabel = ${errorLabelLiteral};
  var __scAuthoredRootId = ${authoredRootIdLiteral};
  var __scAuthoredRootAttr = ${jsonScriptLiteral(AUTHORED_ROOT_ID_ATTR)};
  var __scEscapeAttr = function(value) {
    return (value + "").replace(/\\\\/g, "\\\\\\\\").replace(/"/g, "\\\\\\"");
  };
  var __scRootSelector = ${scopeSelectorLiteral} || (__scCompId
    ? '[data-composition-id="' + __scEscapeAttr(__scCompId) + '"]'
    : "");
  var __scRoot = null;
  var __scRootSelectorPattern = ${rootSelectorPatternLiteral};
  var __scTimingSelectorPattern = ${timingSelectorPatternLiteral};
  var __scAuthoredRootIdForms = ${authoredRootIdFormsLiteral};
  var __scAuthoredRootSelector = __scAuthoredRootId
    ? "[" + __scAuthoredRootAttr + '="' + __scEscapeAttr(__scAuthoredRootId) + '"]'
    : "";
  var __scIsSelectorNameChar = function(char) {
    return !!char && /[\\w-]/.test(char);
  };
  var __scReplaceAuthoredRootIdSelectors = function(selector) {
    if (!__scAuthoredRootSelector || !__scAuthoredRootIdForms.length || typeof selector !== "string") {
      return selector;
    }
    var result = "";
    var bracketDepth = 0;
    var quote = null;
    for (var index = 0; index < selector.length; index += 1) {
      var char = selector[index];
      var previousChar = index > 0 ? selector[index - 1] : "";
      if (quote) {
        result += char;
        if (char === quote && previousChar !== "\\\\") {
          quote = null;
        }
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        result += char;
        continue;
      }
      if (char === "[") {
        bracketDepth += 1;
        result += char;
        continue;
      }
      if (char === "]") {
        bracketDepth = Math.max(0, bracketDepth - 1);
        result += char;
        continue;
      }
      if (char === "#" && bracketDepth === 0) {
        var matchedForm = null;
        for (var formIndex = 0; formIndex < __scAuthoredRootIdForms.length; formIndex += 1) {
          var form = __scAuthoredRootIdForms[formIndex];
          if (selector.slice(index + 1, index + 1 + form.length) === form) {
            matchedForm = form;
            break;
          }
        }
        if (matchedForm) {
          var nextChar = selector[index + 1 + matchedForm.length];
          if (!__scIsSelectorNameChar(nextChar)) {
            result += __scAuthoredRootSelector;
            index += matchedForm.length;
            continue;
          }
        }
      }
      result += char;
    }
    return result;
  };
  var __scNormalizeSelector = function(selector) {
    if (!__scCompId || typeof selector !== "string") return selector;
    var normalized = selector
      .replace(new RegExp(__scRootSelectorPattern + '(?:' + __scTimingSelectorPattern + ')+', 'g'), __scRootSelector)
      .replace(new RegExp('(?:' + __scTimingSelectorPattern + ')+' + __scRootSelectorPattern, 'g'), __scRootSelector);
    if (__scAuthoredRootSelector) {
      normalized = __scReplaceAuthoredRootIdSelectors(normalized);
    }
    return normalized;
  };
  var __scFindRoot = function() {
    if (!__scRoot && __scRootSelector) {
      __scRoot = window.document.querySelector(__scRootSelector);
    }
    return __scRoot;
  };
  var __scContains = function(node) {
    var root = __scFindRoot();
    return !root || node === root || root.contains(node);
  };
  var __scQueryAll = function(selector) {
    var root = __scFindRoot();
    if (!root || typeof selector !== "string") {
      return window.document.querySelectorAll(selector);
    }
    return Array.prototype.filter.call(window.document.querySelectorAll(__scNormalizeSelector(selector)), function(node) {
      return __scContains(node);
    });
  };
  var __scQueryOne = function(selector) {
    var matches = __scQueryAll(selector);
    return matches[0] || null;
  };
  var __scGetElementById = function(id) {
    var found = window.document.getElementById(id);
    if (found && __scContains(found)) return found;
    var root = __scFindRoot();
    if (!root) return found || null;
    var idValue = id + "";
    if (__scAuthoredRootId && __scAuthoredRootId === idValue && root.getAttribute && root.getAttribute(__scAuthoredRootAttr) === idValue) {
      return root;
    }
    if (root.id === idValue) return root;
    if (typeof root.querySelector !== "function") return null;
    try {
      var authoredRootMatch = root.querySelector('[' + __scAuthoredRootAttr + '="' + __scEscapeAttr(idValue) + '"]');
      if (authoredRootMatch) return authoredRootMatch;
    } catch {}
    if (typeof CSS !== "undefined" && CSS && typeof CSS.escape === "function") {
      try {
        return root.querySelector("#" + CSS.escape(idValue)) || null;
      } catch {}
    }
    try {
      return root.querySelector('[id="' + __scEscapeAttr(idValue) + '"]') || null;
    } catch {}
    return null;
  };
  var __scScopedDocument = typeof Proxy === "function"
    ? new Proxy(window.document, {
        get: function(target, prop, receiver) {
          if (prop === "querySelector") return __scQueryOne;
          if (prop === "querySelectorAll") return __scQueryAll;
          if (prop === "getElementById") return __scGetElementById;
          var value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      })
    : window.document;
  var __scTimelineRegistryProxy = null;
  var __scGetTimelineRegistry = function() {
    window.__timelines = window.__timelines || {};
    if (!__scCompId || __scCompId === __scTimelineCompId || typeof Proxy !== "function") {
      return window.__timelines;
    }
    if (!__scTimelineRegistryProxy) {
      __scTimelineRegistryProxy = new Proxy(window.__timelines, {
        get: function(target, prop, receiver) {
          if (prop !== __scCompId) {
            return Reflect.get(target, prop, target);
          }
          var authoredValue = Reflect.get(target, prop, target);
          return authoredValue === undefined
            ? Reflect.get(target, __scTimelineCompId, target)
            : authoredValue;
        },
        set: function(target, prop, value, receiver) {
          if (prop !== __scCompId) {
            return Reflect.set(target, prop, value, target);
          }
          // The authored node remains in the compiled DOM when its local id
          // differs from the runtime mount id, so readiness legitimately sees
          // both compositions. Publish the same timeline under both identities
          // instead of replacing one with the other.
          var authoredSet = Reflect.set(target, __scCompId, value, target);
          var runtimeSet = Reflect.set(target, __scTimelineCompId, value, target);
          return authoredSet && runtimeSet;
        },
      });
    }
    return __scTimelineRegistryProxy;
  };
  var __scScopedWindow = typeof Proxy === "function"
    ? new Proxy(window, {
        get: function(target, prop, receiver) {
          if (prop === "__timelines") return __scGetTimelineRegistry();
          // Inside a sub-composition, __smashcut is passed as a bare script
          // param bound to the SCOPED variant (per-comp getVariables). But
          // authors routinely write the documented window.__smashcut.
          // getVariables() form, which would otherwise fall through to the host
          // page's base __smashcut and return the WRONG (or empty) variables
          // for this instance. Route it to the scoped variant too so both
          // spellings resolve to this composition's own variables.
          // (__scScopedSmashcut is a hoisted var assigned below, before any
          // sub-comp script -- the only code that reads this -- runs.)
          if (prop === "__smashcut") return __scScopedSmashcut;
          // Native window methods must stay bound to the real window. Handed
          // back unbound, "this" at call time is this Proxy and Chrome rejects
          // it with "Illegal invocation", which broke window.addEventListener,
          // setTimeout, matchMedia and getComputedStyle inside every
          // sub-composition -- including the window.addEventListener("sc-seek",
          // ...) form the Three.js and TypeGPU adapters document. The sibling
          // document and gsap proxies here already bind.
          //
          // Only bind non-constructors. Function.prototype.bind drops static
          // members, so binding a class exposed on window (window.Texts and
          // friends) would silently strip its statics. Built-in methods have
          // no .prototype; classes and constructor functions do.
          var value = Reflect.get(target, prop, target);
          return typeof value === "function" && value.prototype === undefined
            ? value.bind(target)
            : value;
        },
        set: function(target, prop, value, receiver) {
          if (prop === "__timelines") {
            // Common authoring boilerplate assigns the registry back to
            // itself (window.__timelines = window.__timelines || {}). The
            // getter above returns our proxy; do not replace the canonical
            // registry with that proxy or later wrappers will stack proxies.
            if (value === __scTimelineRegistryProxy) return true;
            target.__timelines = value || {};
            __scTimelineRegistryProxy = null;
            return true;
          }
          return Reflect.set(target, prop, value, target);
        },
      })
    : window;
  var __scResolveGsapTarget = function(target) {
    if (typeof target !== "string") return target;
    return __scQueryAll(target);
  };
  var __scScopeTimeline = function(timeline) {
    if (!timeline || timeline.__scScopedCompositionRoot === __scFindRoot()) return timeline;
    ["to", "from", "fromTo", "set"].forEach(function(method) {
      var original = timeline[method];
      if (typeof original !== "function") return;
      timeline[method] = function(target) {
        var args = Array.prototype.slice.call(arguments);
        args[0] = __scResolveGsapTarget(target);
        return original.apply(timeline, args);
      };
    });
    try {
      Object.defineProperty(timeline, "__scScopedCompositionRoot", {
        value: __scFindRoot(),
        configurable: true,
      });
    } catch {
      // Best-effort: timelines coming from user code may have a frozen target
      // or a non-extensible defineProperty path. Swallow — the scoped root
      // is an enrichment, not a correctness invariant for playback.
    }
    return timeline;
  };
  var __scBaseGsap = typeof gsap === "undefined" ? window.gsap : gsap;
  var __scScopedGsap = !__scBaseGsap || typeof Proxy !== "function"
    ? __scBaseGsap
    : new Proxy(__scBaseGsap, {
        get: function(target, prop, receiver) {
          if (prop === "timeline") {
            return function() {
              return __scScopeTimeline(target.timeline.apply(target, arguments));
            };
          }
          if (prop === "to" || prop === "from" || prop === "fromTo" || prop === "set") {
            return function(firstArg) {
              var args = Array.prototype.slice.call(arguments);
              args[0] = __scResolveGsapTarget(firstArg);
              return target[prop].apply(target, args);
            };
          }
          if (prop === "utils" && target.utils && typeof Proxy === "function") {
            return new Proxy(target.utils, {
              get: function(utilsTarget, utilsProp, utilsReceiver) {
                if (utilsProp === "toArray") {
                  return function(firstArg) {
                    var args = Array.prototype.slice.call(arguments);
                    args[0] = __scResolveGsapTarget(firstArg);
                    return utilsTarget.toArray.apply(utilsTarget, args);
                  };
                }
                if (utilsProp === "selector") {
                  return function(base) {
                    var baseEl = typeof base === "string" ? __scQueryOne(base) : base;
                    var root = baseEl || __scFindRoot();
                    return function(selector) {
                      if (!root || typeof selector !== "string") return [];
                      return Array.prototype.filter.call(
                        window.document.querySelectorAll(__scNormalizeSelector(selector)),
                        function(node) {
                          return node === root || (typeof root.contains === "function" && root.contains(node));
                        },
                      );
                    };
                  };
                }
                var value = Reflect.get(utilsTarget, utilsProp, utilsTarget);
                return typeof value === "function" ? value.bind(utilsTarget) : value;
              },
            });
          }
          var value = Reflect.get(target, prop, target);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
  var __scBaseSmashcut = window.__smashcut;
  var __scScopedSmashcut = !__scBaseSmashcut
    ? __scBaseSmashcut
    : Object.assign({}, __scBaseSmashcut, {
        getVariables: function() {
          var byComp = window.__scVariablesByComp;
          var scoped = byComp && __scTimelineCompId ? byComp[__scTimelineCompId] : null;
          return scoped ? Object.assign({}, scoped) : {};
        },
      });
  var __scRun = function() {
    try {
      (function(document, gsap, window, __smashcut) {
${source.replace(/<\/(script)/gi, "<\\/$1")}
      }).call(window, __scScopedDocument, __scScopedGsap, __scScopedWindow, __scScopedSmashcut);
    } catch (_err) {
      console.error(__scErrorLabel, __scCompId, _err);
    }
  };
  __scFindRoot();
  __scRun();
})();`;
}

export function wrapInlineScriptWithErrorBoundary(source: string, errorLabel: string): string {
  return `(function(){ try { Function(${jsonScriptLiteral(source)}).call(window); } catch (_err) { console.error(${jsonScriptLiteral(errorLabel)}, _err); } })();`;
}

/**
 * Build the statement that populates `window.__scVariablesByComp` — the table
 * the scoped `getVariables` above reads. Returns `null` when there are no
 * per-instance values.
 *
 * The WRITER lives next to the READER (the scoped `getVariables` in
 * `wrapScopedCompositionScript`) on purpose: every compile path that wraps the
 * reader MUST also emit this writer before the sub-comp scripts run. The
 * render compiler (`htmlCompiler`) inlined the reader scripts but never emitted
 * the writer while the preview bundler (`htmlBundler`) did, so
 * `getVariables()` returned `{}` only during render — parametrized sub-comps
 * silently shipped blank/default text in the final MP4 while snapshot QA passed
 * (issue #2064). Both callers now share this one builder so they can't drift.
 *
 * Values, keys and composition ids are all attacker-reachable, so the whole
 * table goes through `jsonScriptLiteral` — see there for why.
 */
export function buildVariablesByCompScript(
  variablesByComp: Record<string, Record<string, unknown>>,
): string | null {
  if (!variablesByComp || Object.keys(variablesByComp).length === 0) return null;
  const json = jsonScriptLiteral(variablesByComp);
  return `window.__scVariablesByComp = Object.assign({}, window.__scVariablesByComp || {}, ${json});`;
}
