var background = (function() {
  "use strict";var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  var _a, _b, _c, _d, _e;
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const createStoreImpl = (createState) => {
    let state;
    const listeners = /* @__PURE__ */ new Set();
    const setState = (partial, replace) => {
      const nextState = typeof partial === "function" ? partial(state) : partial;
      if (!Object.is(nextState, state)) {
        const previousState = state;
        state = (replace != null ? replace : typeof nextState !== "object" || nextState === null) ? nextState : Object.assign({}, state, nextState);
        listeners.forEach((listener) => listener(state, previousState));
      }
    };
    const getState = () => state;
    const getInitialState = () => initialState;
    const subscribe = (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    };
    const api = { setState, getState, getInitialState, subscribe };
    const initialState = state = createState(setState, getState, api);
    return api;
  };
  const createStore = ((createState) => createState ? createStoreImpl(createState) : createStoreImpl);
  function getDefaultExportFromCjs(x) {
    return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
  }
  var react = { exports: {} };
  var react_development = { exports: {} };
  react_development.exports;
  var hasRequiredReact_development;
  function requireReact_development() {
    if (hasRequiredReact_development) return react_development.exports;
    hasRequiredReact_development = 1;
    (function(module, exports) {
      /**
       * @license React
       * react.development.js
       *
       * Copyright (c) Meta Platforms, Inc. and affiliates.
       *
       * This source code is licensed under the MIT license found in the
       * LICENSE file in the root directory of this source tree.
       */
      (function() {
        function defineDeprecationWarning(methodName, info) {
          Object.defineProperty(Component.prototype, methodName, {
            get: function() {
              console.warn(
                "%s(...) is deprecated in plain JavaScript React classes. %s",
                info[0],
                info[1]
              );
            }
          });
        }
        function getIteratorFn(maybeIterable) {
          if (null === maybeIterable || "object" !== typeof maybeIterable)
            return null;
          maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
          return "function" === typeof maybeIterable ? maybeIterable : null;
        }
        function warnNoop(publicInstance, callerName) {
          publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
          var warningKey = publicInstance + "." + callerName;
          didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error(
            "Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.",
            callerName,
            publicInstance
          ), didWarnStateUpdateForUnmountedComponent[warningKey] = true);
        }
        function Component(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        function ComponentDummy() {
        }
        function PureComponent(props, context, updater) {
          this.props = props;
          this.context = context;
          this.refs = emptyObject;
          this.updater = updater || ReactNoopUpdateQueue;
        }
        function noop() {
        }
        function testStringCoercion(value) {
          return "" + value;
        }
        function checkKeyStringCoercion(value) {
          try {
            testStringCoercion(value);
            var JSCompiler_inline_result = false;
          } catch (e) {
            JSCompiler_inline_result = true;
          }
          if (JSCompiler_inline_result) {
            JSCompiler_inline_result = console;
            var JSCompiler_temp_const = JSCompiler_inline_result.error;
            var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
            JSCompiler_temp_const.call(
              JSCompiler_inline_result,
              "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.",
              JSCompiler_inline_result$jscomp$0
            );
            return testStringCoercion(value);
          }
        }
        function getComponentNameFromType(type) {
          if (null == type) return null;
          if ("function" === typeof type)
            return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
          if ("string" === typeof type) return type;
          switch (type) {
            case REACT_FRAGMENT_TYPE:
              return "Fragment";
            case REACT_PROFILER_TYPE:
              return "Profiler";
            case REACT_STRICT_MODE_TYPE:
              return "StrictMode";
            case REACT_SUSPENSE_TYPE:
              return "Suspense";
            case REACT_SUSPENSE_LIST_TYPE:
              return "SuspenseList";
            case REACT_ACTIVITY_TYPE:
              return "Activity";
          }
          if ("object" === typeof type)
            switch ("number" === typeof type.tag && console.error(
              "Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."
            ), type.$$typeof) {
              case REACT_PORTAL_TYPE:
                return "Portal";
              case REACT_CONTEXT_TYPE:
                return type.displayName || "Context";
              case REACT_CONSUMER_TYPE:
                return (type._context.displayName || "Context") + ".Consumer";
              case REACT_FORWARD_REF_TYPE:
                var innerType = type.render;
                type = type.displayName;
                type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
                return type;
              case REACT_MEMO_TYPE:
                return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
              case REACT_LAZY_TYPE:
                innerType = type._payload;
                type = type._init;
                try {
                  return getComponentNameFromType(type(innerType));
                } catch (x) {
                }
            }
          return null;
        }
        function getTaskName(type) {
          if (type === REACT_FRAGMENT_TYPE) return "<>";
          if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE)
            return "<...>";
          try {
            var name = getComponentNameFromType(type);
            return name ? "<" + name + ">" : "<...>";
          } catch (x) {
            return "<...>";
          }
        }
        function getOwner() {
          var dispatcher = ReactSharedInternals.A;
          return null === dispatcher ? null : dispatcher.getOwner();
        }
        function UnknownOwner() {
          return Error("react-stack-top-frame");
        }
        function hasValidKey(config) {
          if (hasOwnProperty.call(config, "key")) {
            var getter = Object.getOwnPropertyDescriptor(config, "key").get;
            if (getter && getter.isReactWarning) return false;
          }
          return void 0 !== config.key;
        }
        function defineKeyPropWarningGetter(props, displayName) {
          function warnAboutAccessingKey() {
            specialPropKeyWarningShown || (specialPropKeyWarningShown = true, console.error(
              "%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)",
              displayName
            ));
          }
          warnAboutAccessingKey.isReactWarning = true;
          Object.defineProperty(props, "key", {
            get: warnAboutAccessingKey,
            configurable: true
          });
        }
        function elementRefGetterWithDeprecationWarning() {
          var componentName = getComponentNameFromType(this.type);
          didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = true, console.error(
            "Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."
          ));
          componentName = this.props.ref;
          return void 0 !== componentName ? componentName : null;
        }
        function ReactElement(type, key, props, owner, debugStack, debugTask) {
          var refProp = props.ref;
          type = {
            $$typeof: REACT_ELEMENT_TYPE,
            type,
            key,
            props,
            _owner: owner
          };
          null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
            enumerable: false,
            get: elementRefGetterWithDeprecationWarning
          }) : Object.defineProperty(type, "ref", { enumerable: false, value: null });
          type._store = {};
          Object.defineProperty(type._store, "validated", {
            configurable: false,
            enumerable: false,
            writable: true,
            value: 0
          });
          Object.defineProperty(type, "_debugInfo", {
            configurable: false,
            enumerable: false,
            writable: true,
            value: null
          });
          Object.defineProperty(type, "_debugStack", {
            configurable: false,
            enumerable: false,
            writable: true,
            value: debugStack
          });
          Object.defineProperty(type, "_debugTask", {
            configurable: false,
            enumerable: false,
            writable: true,
            value: debugTask
          });
          Object.freeze && (Object.freeze(type.props), Object.freeze(type));
          return type;
        }
        function cloneAndReplaceKey(oldElement, newKey) {
          newKey = ReactElement(
            oldElement.type,
            newKey,
            oldElement.props,
            oldElement._owner,
            oldElement._debugStack,
            oldElement._debugTask
          );
          oldElement._store && (newKey._store.validated = oldElement._store.validated);
          return newKey;
        }
        function validateChildKeys(node) {
          isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
        }
        function isValidElement(object) {
          return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
        }
        function escape(key) {
          var escaperLookup = { "=": "=0", ":": "=2" };
          return "$" + key.replace(/[=:]/g, function(match) {
            return escaperLookup[match];
          });
        }
        function getElementKey(element, index) {
          return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
        }
        function resolveThenable(thenable) {
          switch (thenable.status) {
            case "fulfilled":
              return thenable.value;
            case "rejected":
              throw thenable.reason;
            default:
              switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(
                function(fulfilledValue) {
                  "pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
                },
                function(error) {
                  "pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
                }
              )), thenable.status) {
                case "fulfilled":
                  return thenable.value;
                case "rejected":
                  throw thenable.reason;
              }
          }
          throw thenable;
        }
        function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
          var type = typeof children;
          if ("undefined" === type || "boolean" === type) children = null;
          var invokeCallback = false;
          if (null === children) invokeCallback = true;
          else
            switch (type) {
              case "bigint":
              case "string":
              case "number":
                invokeCallback = true;
                break;
              case "object":
                switch (children.$$typeof) {
                  case REACT_ELEMENT_TYPE:
                  case REACT_PORTAL_TYPE:
                    invokeCallback = true;
                    break;
                  case REACT_LAZY_TYPE:
                    return invokeCallback = children._init, mapIntoArray(
                      invokeCallback(children._payload),
                      array,
                      escapedPrefix,
                      nameSoFar,
                      callback
                    );
                }
            }
          if (invokeCallback) {
            invokeCallback = children;
            callback = callback(invokeCallback);
            var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
            isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
              return c;
            })) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(
              callback,
              escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(
                userProvidedKeyEscapeRegex,
                "$&/"
              ) + "/") + childKey
            ), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
            return 1;
          }
          invokeCallback = 0;
          childKey = "" === nameSoFar ? "." : nameSoFar + ":";
          if (isArrayImpl(children))
            for (var i = 0; i < children.length; i++)
              nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(
                nameSoFar,
                array,
                escapedPrefix,
                type,
                callback
              );
          else if (i = getIteratorFn(children), "function" === typeof i)
            for (i === children.entries && (didWarnAboutMaps || console.warn(
              "Using Maps as children is not supported. Use an array of keyed ReactElements instead."
            ), didWarnAboutMaps = true), children = i.call(children), i = 0; !(nameSoFar = children.next()).done; )
              nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(
                nameSoFar,
                array,
                escapedPrefix,
                type,
                callback
              );
          else if ("object" === type) {
            if ("function" === typeof children.then)
              return mapIntoArray(
                resolveThenable(children),
                array,
                escapedPrefix,
                nameSoFar,
                callback
              );
            array = String(children);
            throw Error(
              "Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead."
            );
          }
          return invokeCallback;
        }
        function mapChildren(children, func, context) {
          if (null == children) return children;
          var result2 = [], count = 0;
          mapIntoArray(children, result2, "", "", function(child) {
            return func.call(context, child, count++);
          });
          return result2;
        }
        function lazyInitializer(payload) {
          if (-1 === payload._status) {
            var ioInfo = payload._ioInfo;
            null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
            ioInfo = payload._result;
            var thenable = ioInfo();
            thenable.then(
              function(moduleObject) {
                if (0 === payload._status || -1 === payload._status) {
                  payload._status = 1;
                  payload._result = moduleObject;
                  var _ioInfo = payload._ioInfo;
                  null != _ioInfo && (_ioInfo.end = performance.now());
                  void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
                }
              },
              function(error) {
                if (0 === payload._status || -1 === payload._status) {
                  payload._status = 2;
                  payload._result = error;
                  var _ioInfo2 = payload._ioInfo;
                  null != _ioInfo2 && (_ioInfo2.end = performance.now());
                  void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
                }
              }
            );
            ioInfo = payload._ioInfo;
            if (null != ioInfo) {
              ioInfo.value = thenable;
              var displayName = thenable.displayName;
              "string" === typeof displayName && (ioInfo.name = displayName);
            }
            -1 === payload._status && (payload._status = 0, payload._result = thenable);
          }
          if (1 === payload._status)
            return ioInfo = payload._result, void 0 === ioInfo && console.error(
              "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?",
              ioInfo
            ), "default" in ioInfo || console.error(
              "lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))",
              ioInfo
            ), ioInfo.default;
          throw payload._result;
        }
        function resolveDispatcher() {
          var dispatcher = ReactSharedInternals.H;
          null === dispatcher && console.error(
            "Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem."
          );
          return dispatcher;
        }
        function releaseAsyncTransition() {
          ReactSharedInternals.asyncTransitions--;
        }
        function enqueueTask(task) {
          if (null === enqueueTaskImpl)
            try {
              var requireString = ("require" + Math.random()).slice(0, 7);
              enqueueTaskImpl = (module && module[requireString]).call(
                module,
                "timers"
              ).setImmediate;
            } catch (_err) {
              enqueueTaskImpl = function(callback) {
                false === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = true, "undefined" === typeof MessageChannel && console.error(
                  "This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."
                ));
                var channel = new MessageChannel();
                channel.port1.onmessage = callback;
                channel.port2.postMessage(void 0);
              };
            }
          return enqueueTaskImpl(task);
        }
        function aggregateErrors(errors) {
          return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
        }
        function popActScope(prevActQueue, prevActScopeDepth) {
          prevActScopeDepth !== actScopeDepth - 1 && console.error(
            "You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. "
          );
          actScopeDepth = prevActScopeDepth;
        }
        function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
          var queue = ReactSharedInternals.actQueue;
          if (null !== queue)
            if (0 !== queue.length)
              try {
                flushActQueue(queue);
                enqueueTask(function() {
                  return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
                });
                return;
              } catch (error) {
                ReactSharedInternals.thrownErrors.push(error);
              }
            else ReactSharedInternals.actQueue = null;
          0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
        }
        function flushActQueue(queue) {
          if (!isFlushing) {
            isFlushing = true;
            var i = 0;
            try {
              for (; i < queue.length; i++) {
                var callback = queue[i];
                do {
                  ReactSharedInternals.didUsePromise = false;
                  var continuation = callback(false);
                  if (null !== continuation) {
                    if (ReactSharedInternals.didUsePromise) {
                      queue[i] = callback;
                      queue.splice(0, i);
                      return;
                    }
                    callback = continuation;
                  } else break;
                } while (1);
              }
              queue.length = 0;
            } catch (error) {
              queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
            } finally {
              isFlushing = false;
            }
          }
        }
        "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
        var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
          isMounted: function() {
            return false;
          },
          enqueueForceUpdate: function(publicInstance) {
            warnNoop(publicInstance, "forceUpdate");
          },
          enqueueReplaceState: function(publicInstance) {
            warnNoop(publicInstance, "replaceState");
          },
          enqueueSetState: function(publicInstance) {
            warnNoop(publicInstance, "setState");
          }
        }, assign = Object.assign, emptyObject = {};
        Object.freeze(emptyObject);
        Component.prototype.isReactComponent = {};
        Component.prototype.setState = function(partialState, callback) {
          if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState)
            throw Error(
              "takes an object of state variables to update or a function which returns an object of state variables."
            );
          this.updater.enqueueSetState(this, partialState, callback, "setState");
        };
        Component.prototype.forceUpdate = function(callback) {
          this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
        };
        var deprecatedAPIs = {
          isMounted: [
            "isMounted",
            "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."
          ],
          replaceState: [
            "replaceState",
            "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."
          ]
        };
        for (fnName in deprecatedAPIs)
          deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
        ComponentDummy.prototype = Component.prototype;
        deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
        deprecatedAPIs.constructor = PureComponent;
        assign(deprecatedAPIs, Component.prototype);
        deprecatedAPIs.isPureReactComponent = true;
        var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
          H: null,
          A: null,
          T: null,
          S: null,
          actQueue: null,
          asyncTransitions: 0,
          isBatchingLegacy: false,
          didScheduleLegacyUpdate: false,
          didUsePromise: false,
          thrownErrors: [],
          getCurrentStack: null,
          recentlyCreatedOwnerStacks: 0
        }, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
          return null;
        };
        deprecatedAPIs = {
          react_stack_bottom_frame: function(callStackForError) {
            return callStackForError();
          }
        };
        var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
        var didWarnAboutElementRef = {};
        var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(
          deprecatedAPIs,
          UnknownOwner
        )();
        var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
        var didWarnAboutMaps = false, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
          if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
            var event = new window.ErrorEvent("error", {
              bubbles: true,
              cancelable: true,
              message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
              error
            });
            if (!window.dispatchEvent(event)) return;
          } else if ("object" === typeof process && "function" === typeof process.emit) {
            process.emit("uncaughtException", error);
            return;
          }
          console.error(error);
        }, didWarnAboutMessageChannel = false, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = false, isFlushing = false, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
          queueMicrotask(function() {
            return queueMicrotask(callback);
          });
        } : enqueueTask;
        deprecatedAPIs = Object.freeze({
          __proto__: null,
          c: function(size) {
            return resolveDispatcher().useMemoCache(size);
          }
        });
        var fnName = {
          map: mapChildren,
          forEach: function(children, forEachFunc, forEachContext) {
            mapChildren(
              children,
              function() {
                forEachFunc.apply(this, arguments);
              },
              forEachContext
            );
          },
          count: function(children) {
            var n = 0;
            mapChildren(children, function() {
              n++;
            });
            return n;
          },
          toArray: function(children) {
            return mapChildren(children, function(child) {
              return child;
            }) || [];
          },
          only: function(children) {
            if (!isValidElement(children))
              throw Error(
                "React.Children.only expected to receive a single React element child."
              );
            return children;
          }
        };
        exports.Activity = REACT_ACTIVITY_TYPE;
        exports.Children = fnName;
        exports.Component = Component;
        exports.Fragment = REACT_FRAGMENT_TYPE;
        exports.Profiler = REACT_PROFILER_TYPE;
        exports.PureComponent = PureComponent;
        exports.StrictMode = REACT_STRICT_MODE_TYPE;
        exports.Suspense = REACT_SUSPENSE_TYPE;
        exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
        exports.__COMPILER_RUNTIME = deprecatedAPIs;
        exports.act = function(callback) {
          var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
          actScopeDepth++;
          var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = false;
          try {
            var result2 = callback();
          } catch (error) {
            ReactSharedInternals.thrownErrors.push(error);
          }
          if (0 < ReactSharedInternals.thrownErrors.length)
            throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
          if (null !== result2 && "object" === typeof result2 && "function" === typeof result2.then) {
            var thenable = result2;
            queueSeveralMicrotasks(function() {
              didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
                "You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"
              ));
            });
            return {
              then: function(resolve, reject) {
                didAwaitActCall = true;
                thenable.then(
                  function(returnValue) {
                    popActScope(prevActQueue, prevActScopeDepth);
                    if (0 === prevActScopeDepth) {
                      try {
                        flushActQueue(queue), enqueueTask(function() {
                          return recursivelyFlushAsyncActWork(
                            returnValue,
                            resolve,
                            reject
                          );
                        });
                      } catch (error$0) {
                        ReactSharedInternals.thrownErrors.push(error$0);
                      }
                      if (0 < ReactSharedInternals.thrownErrors.length) {
                        var _thrownError = aggregateErrors(
                          ReactSharedInternals.thrownErrors
                        );
                        ReactSharedInternals.thrownErrors.length = 0;
                        reject(_thrownError);
                      }
                    } else resolve(returnValue);
                  },
                  function(error) {
                    popActScope(prevActQueue, prevActScopeDepth);
                    0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(
                      ReactSharedInternals.thrownErrors
                    ), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
                  }
                );
              }
            };
          }
          var returnValue$jscomp$0 = result2;
          popActScope(prevActQueue, prevActScopeDepth);
          0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
            didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = true, console.error(
              "A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"
            ));
          }), ReactSharedInternals.actQueue = null);
          if (0 < ReactSharedInternals.thrownErrors.length)
            throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
          return {
            then: function(resolve, reject) {
              didAwaitActCall = true;
              0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
                return recursivelyFlushAsyncActWork(
                  returnValue$jscomp$0,
                  resolve,
                  reject
                );
              })) : resolve(returnValue$jscomp$0);
            }
          };
        };
        exports.cache = function(fn) {
          return function() {
            return fn.apply(null, arguments);
          };
        };
        exports.cacheSignal = function() {
          return null;
        };
        exports.captureOwnerStack = function() {
          var getCurrentStack = ReactSharedInternals.getCurrentStack;
          return null === getCurrentStack ? null : getCurrentStack();
        };
        exports.cloneElement = function(element, config, children) {
          if (null === element || void 0 === element)
            throw Error(
              "The argument must be a React element, but you passed " + element + "."
            );
          var props = assign({}, element.props), key = element.key, owner = element._owner;
          if (null != config) {
            var JSCompiler_inline_result;
            a: {
              if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(
                config,
                "ref"
              ).get) && JSCompiler_inline_result.isReactWarning) {
                JSCompiler_inline_result = false;
                break a;
              }
              JSCompiler_inline_result = void 0 !== config.ref;
            }
            JSCompiler_inline_result && (owner = getOwner());
            hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
            for (propName in config)
              !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
          }
          var propName = arguments.length - 2;
          if (1 === propName) props.children = children;
          else if (1 < propName) {
            JSCompiler_inline_result = Array(propName);
            for (var i = 0; i < propName; i++)
              JSCompiler_inline_result[i] = arguments[i + 2];
            props.children = JSCompiler_inline_result;
          }
          props = ReactElement(
            element.type,
            key,
            props,
            owner,
            element._debugStack,
            element._debugTask
          );
          for (key = 2; key < arguments.length; key++)
            validateChildKeys(arguments[key]);
          return props;
        };
        exports.createContext = function(defaultValue) {
          defaultValue = {
            $$typeof: REACT_CONTEXT_TYPE,
            _currentValue: defaultValue,
            _currentValue2: defaultValue,
            _threadCount: 0,
            Provider: null,
            Consumer: null
          };
          defaultValue.Provider = defaultValue;
          defaultValue.Consumer = {
            $$typeof: REACT_CONSUMER_TYPE,
            _context: defaultValue
          };
          defaultValue._currentRenderer = null;
          defaultValue._currentRenderer2 = null;
          return defaultValue;
        };
        exports.createElement = function(type, config, children) {
          for (var i = 2; i < arguments.length; i++)
            validateChildKeys(arguments[i]);
          i = {};
          var key = null;
          if (null != config)
            for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = true, console.warn(
              "Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform"
            )), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config)
              hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
          var childrenLength = arguments.length - 2;
          if (1 === childrenLength) i.children = children;
          else if (1 < childrenLength) {
            for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++)
              childArray[_i] = arguments[_i + 2];
            Object.freeze && Object.freeze(childArray);
            i.children = childArray;
          }
          if (type && type.defaultProps)
            for (propName in childrenLength = type.defaultProps, childrenLength)
              void 0 === i[propName] && (i[propName] = childrenLength[propName]);
          key && defineKeyPropWarningGetter(
            i,
            "function" === typeof type ? type.displayName || type.name || "Unknown" : type
          );
          var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
          return ReactElement(
            type,
            key,
            i,
            getOwner(),
            propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack,
            propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask
          );
        };
        exports.createRef = function() {
          var refObject = { current: null };
          Object.seal(refObject);
          return refObject;
        };
        exports.forwardRef = function(render) {
          null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error(
            "forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...))."
          ) : "function" !== typeof render ? console.error(
            "forwardRef requires a render function but was given %s.",
            null === render ? "null" : typeof render
          ) : 0 !== render.length && 2 !== render.length && console.error(
            "forwardRef render functions accept exactly two parameters: props and ref. %s",
            1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined."
          );
          null != render && null != render.defaultProps && console.error(
            "forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?"
          );
          var elementType = { $$typeof: REACT_FORWARD_REF_TYPE, render }, ownName;
          Object.defineProperty(elementType, "displayName", {
            enumerable: false,
            configurable: true,
            get: function() {
              return ownName;
            },
            set: function(name) {
              ownName = name;
              render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
            }
          });
          return elementType;
        };
        exports.isValidElement = isValidElement;
        exports.lazy = function(ctor) {
          ctor = { _status: -1, _result: ctor };
          var lazyType = {
            $$typeof: REACT_LAZY_TYPE,
            _payload: ctor,
            _init: lazyInitializer
          }, ioInfo = {
            name: "lazy",
            start: -1,
            end: -1,
            value: null,
            owner: null,
            debugStack: Error("react-stack-top-frame"),
            debugTask: console.createTask ? console.createTask("lazy()") : null
          };
          ctor._ioInfo = ioInfo;
          lazyType._debugInfo = [{ awaited: ioInfo }];
          return lazyType;
        };
        exports.memo = function(type, compare) {
          null == type && console.error(
            "memo: The first argument must be a component. Instead received: %s",
            null === type ? "null" : typeof type
          );
          compare = {
            $$typeof: REACT_MEMO_TYPE,
            type,
            compare: void 0 === compare ? null : compare
          };
          var ownName;
          Object.defineProperty(compare, "displayName", {
            enumerable: false,
            configurable: true,
            get: function() {
              return ownName;
            },
            set: function(name) {
              ownName = name;
              type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
            }
          });
          return compare;
        };
        exports.startTransition = function(scope) {
          var prevTransition = ReactSharedInternals.T, currentTransition = {};
          currentTransition._updatedFibers = /* @__PURE__ */ new Set();
          ReactSharedInternals.T = currentTransition;
          try {
            var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
            null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
            "object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
          } catch (error) {
            reportGlobalError(error);
          } finally {
            null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn(
              "Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table."
            )), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error(
              "We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."
            ), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
          }
        };
        exports.unstable_useCacheRefresh = function() {
          return resolveDispatcher().useCacheRefresh();
        };
        exports.use = function(usable) {
          return resolveDispatcher().use(usable);
        };
        exports.useActionState = function(action, initialState, permalink) {
          return resolveDispatcher().useActionState(
            action,
            initialState,
            permalink
          );
        };
        exports.useCallback = function(callback, deps) {
          return resolveDispatcher().useCallback(callback, deps);
        };
        exports.useContext = function(Context) {
          var dispatcher = resolveDispatcher();
          Context.$$typeof === REACT_CONSUMER_TYPE && console.error(
            "Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?"
          );
          return dispatcher.useContext(Context);
        };
        exports.useDebugValue = function(value, formatterFn) {
          return resolveDispatcher().useDebugValue(value, formatterFn);
        };
        exports.useDeferredValue = function(value, initialValue) {
          return resolveDispatcher().useDeferredValue(value, initialValue);
        };
        exports.useEffect = function(create2, deps) {
          null == create2 && console.warn(
            "React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?"
          );
          return resolveDispatcher().useEffect(create2, deps);
        };
        exports.useEffectEvent = function(callback) {
          return resolveDispatcher().useEffectEvent(callback);
        };
        exports.useId = function() {
          return resolveDispatcher().useId();
        };
        exports.useImperativeHandle = function(ref, create2, deps) {
          return resolveDispatcher().useImperativeHandle(ref, create2, deps);
        };
        exports.useInsertionEffect = function(create2, deps) {
          null == create2 && console.warn(
            "React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?"
          );
          return resolveDispatcher().useInsertionEffect(create2, deps);
        };
        exports.useLayoutEffect = function(create2, deps) {
          null == create2 && console.warn(
            "React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?"
          );
          return resolveDispatcher().useLayoutEffect(create2, deps);
        };
        exports.useMemo = function(create2, deps) {
          return resolveDispatcher().useMemo(create2, deps);
        };
        exports.useOptimistic = function(passthrough, reducer) {
          return resolveDispatcher().useOptimistic(passthrough, reducer);
        };
        exports.useReducer = function(reducer, initialArg, init) {
          return resolveDispatcher().useReducer(reducer, initialArg, init);
        };
        exports.useRef = function(initialValue) {
          return resolveDispatcher().useRef(initialValue);
        };
        exports.useState = function(initialState) {
          return resolveDispatcher().useState(initialState);
        };
        exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
          return resolveDispatcher().useSyncExternalStore(
            subscribe,
            getSnapshot,
            getServerSnapshot
          );
        };
        exports.useTransition = function() {
          return resolveDispatcher().useTransition();
        };
        exports.version = "19.2.8";
        "undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
      })();
    })(react_development, react_development.exports);
    return react_development.exports;
  }
  var hasRequiredReact;
  function requireReact() {
    if (hasRequiredReact) return react.exports;
    hasRequiredReact = 1;
    {
      react.exports = requireReact_development();
    }
    return react.exports;
  }
  var reactExports = requireReact();
  const React = /* @__PURE__ */ getDefaultExportFromCjs(reactExports);
  const identity = (arg) => arg;
  function useStore(api, selector = identity) {
    const slice = React.useSyncExternalStore(
      api.subscribe,
      React.useCallback(() => selector(api.getState()), [api, selector]),
      React.useCallback(() => selector(api.getInitialState()), [api, selector])
    );
    React.useDebugValue(slice);
    return slice;
  }
  const createImpl = (createState) => {
    const api = createStore(createState);
    const useBoundStore = (selector) => useStore(api, selector);
    Object.assign(useBoundStore, api);
    return useBoundStore;
  };
  const create = ((createState) => createState ? createImpl(createState) : createImpl);
  const DEFAULT_EXT_RULES = [
    "flv",
    "hlv",
    "f4v",
    "mp4",
    "mp3",
    "wma",
    "wav",
    "m4a",
    "ts",
    "webm",
    "ogg",
    "ogv",
    "acc",
    "mov",
    "mkv",
    "m4s",
    "m3u8",
    "m3u",
    "mpeg",
    "avi",
    "wmv",
    "asf",
    "movie",
    "divx",
    "mpeg4",
    "vid",
    "aac",
    "mpd",
    "weba",
    "opus",
    "srt",
    "vtt"
  ].map((ext) => ({
    ext,
    size: 0,
    operator: ">=",
    unit: "KB",
    state: !["ts", "srt", "vtt"].includes(ext)
  }));
  const DEFAULT_TYPE_RULES = [
    "audio/*",
    "video/*",
    "application/ogg",
    "application/vnd.apple.mpegurl",
    "application/x-mpegurl",
    "application/mpegurl",
    "application/octet-stream-m3u8",
    "application/dash+xml",
    "application/m4s"
  ].map((type) => ({
    type,
    size: 0,
    operator: ">=",
    unit: "KB",
    state: true
  }));
  const DEFAULT_REGEX_RULES = [
    { type: "ig", regex: "https://cache\\.video\\.[a-z]*\\.com/dash\\?tvid=.*", ext: "json", state: false },
    { type: "ig", regex: ".*\\.bilivideo\\.(com|cn).*\\/live-bvc\\/.*m4s", ext: "", blackList: true, state: false },
    { type: "ig", regex: "(^https://scontent[a-z0-9-]*\\.cdninstagram\\.com/.*)&bytestart=.*", ext: "", blackList: false, state: false },
    { type: "ig", regex: "(^https://.*\\.fbcdn\\.net/.*)&bytestart=.*", ext: "", blackList: false, state: false }
  ];
  const DEFAULT_DAMN_URL_PATTERNS = [
    /^https:\/\/.*\.douyin\.com\/.*$/i
  ];
  const DEFAULT_OPTIONS = {
    TitleName: false,
    Player: "",
    ShowWebIco: typeof navigator !== "undefined" && !/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
    MobileUserAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
    // m3u8dl 协议
    m3u8dl: 0,
    m3u8dlArg: '"${url}" --save-dir "%USERPROFILE%\\Downloads\\m3u8dl" --save-name "${title}_${now}" ${referer|exists:\'-H "Referer:*"\'} ${cookie|exists:\'-H "Cookie:*"\'} --no-log',
    m3u8dlConfirm: false,
    playbackRate: 2,
    copyM3U8: "${url}",
    copyMPD: "${url}",
    copyOther: "${url}",
    autoClearMode: 1,
    catDownload: false,
    saveAs: false,
    userAgent: "",
    downFileName: "${title}.${ext}",
    css: "",
    checkDuplicates: true,
    enable: true,
    downActive: typeof navigator !== "undefined" && !/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent),
    downAutoClose: true,
    downStream: false,
    // Aria2
    aria2Rpc: "http://localhost:6800/jsonrpc",
    enableAria2Rpc: false,
    enableAria2RpcReferer: true,
    aria2RpcToken: "",
    aria2RpcDir: "",
    m3u8AutoDown: true,
    badgeNumber: true,
    // 发送到本地
    send2local: false,
    send2localManual: false,
    send2localURL: "http://127.0.0.1:8000/",
    send2localMethod: "POST",
    send2localBody: '{"action": "${action}", "data": ${data}, "tabId": "${tabId}"}',
    send2localType: 0,
    send2localHeaders: "",
    popup: false,
    popupMode: 0,
    // 远程调用
    invoke: false,
    invokeText: 'm3u8dlre:"${url}" --save-dir "%USERPROFILE%\\Downloads" --del-after-done --save-name "${title}_${now}" --auto-select ${referer|exists:\'-H "Referer: *"\'}',
    invokeConfirm: false,
    // m3u8 解析器默认参数
    M3u8Thread: 6,
    M3u8Mp4: false,
    M3u8OnlyAudio: false,
    M3u8SkipDecrypt: false,
    M3u8StreamSaver: false,
    M3u8Ffmpeg: true,
    M3u8AutoClose: false,
    onlineServiceAddress: 0,
    chromeLimitSize: 1.8 * 1024 * 1024 * 1024,
    blockUrl: [],
    blockUrlWhite: false,
    maxLength: typeof navigator !== "undefined" && /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) ? 999 : 9999,
    sidePanel: false,
    deepSearch: false,
    // MQTT
    send2MQTT: false,
    mqttEnable: false,
    mqttBroker: "test.mosquitto.org",
    mqttPort: 8081,
    mqttPath: "/mqtt",
    mqttProtocol: "wss",
    mqttClientId: "cat-catch-client",
    mqttUser: "",
    mqttPassword: "",
    mqttTopic: "cat-catch/media",
    mqttQos: 0,
    mqttTitleLength: 100,
    mqttDataFormat: "",
    getHtmlDOM: false,
    damn: false,
    iframeFFmpeg: false,
    contextMenus: false,
    reverse: false
  };
  const DEFAULT_LOCAL_VAR = {
    featMobileTabId: [],
    featAutoDownTabId: [],
    mediaControl: { tabid: 0, index: -1 },
    previewShowTitle: false,
    previewDeleteDuplicateFilenames: false,
    M3u8HideDownloadedSegments: true
  };
  const DEFAULT_SCRIPT_LIST = [
    ["search.js", { key: "search", refresh: true, allFrames: true, world: "MAIN", name: "deepSearch", off: "closeSearch", i18n: false }],
    ["catch.js", { key: "catch", refresh: true, allFrames: true, world: "MAIN", name: "cacheCapture", off: "closeCapture", i18n: true }],
    ["recorder.js", { key: "recorder", refresh: false, allFrames: true, world: "MAIN", name: "videoRecording", off: "closeRecording", i18n: true }],
    ["recorder2.js", { key: "recorder2", refresh: false, allFrames: false, world: "MAIN", name: "screenCapture", off: "closeCapture", i18n: true }],
    ["webrtc.js", { key: "webrtc", refresh: true, allFrames: true, world: "MAIN", name: "recordWebRTC", off: "closeRecording", i18n: true }]
  ];
  function createFfmpegConfig(onlineServiceAddress = 0) {
    return {
      tab: 0,
      cacheData: [],
      version: 1,
      url: onlineServiceAddress === 0 ? "https://ffmpeg.bmmmd.com/" : "https://ffmpeg.94cat.com/"
    };
  }
  function toExtMap(rules) {
    return new Map(
      rules.map((item) => {
        const next = { ...item };
        if (next.operator === void 0) next.operator = ">=";
        if (next.operator === "~") {
          const [min, max] = String(next.size).split("-");
          next.min = min ? parseInt(min, 10) : 0;
          next.max = max ? parseInt(max, 10) : 0;
        }
        return [item.ext, next];
      })
    );
  }
  function toTypeMap(rules) {
    return new Map(
      rules.map((item) => {
        const next = { ...item };
        if (next.operator === void 0) next.operator = ">=";
        if (next.operator === "~") {
          const [min, max] = String(next.size).split("-");
          next.min = min ? parseInt(min, 10) : 0;
          next.max = max ? parseInt(max, 10) : 0;
        }
        return [item.type, next];
      })
    );
  }
  function compileRegex(rules) {
    return rules.map((item) => {
      let regex;
      try {
        regex = new RegExp(item.regex, item.type);
      } catch {
        return { regex: /(?:)/, ext: item.ext, blackList: !!item.blackList, state: false };
      }
      return { regex, ext: item.ext, blackList: !!item.blackList, state: item.state };
    });
  }
  function compileBlockUrl(rules) {
    return rules.map((item) => ({
      url: wildcardToRegex(item.url),
      state: item.state
    }));
  }
  function wildcardToRegex(urlPattern) {
    const regexPattern = urlPattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
    return new RegExp(`^${regexPattern}$`, "i");
  }
  const isFirefox = typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox") && typeof globalThis.browser !== "undefined" && !!((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.getBrowserInfo);
  function detectVersion() {
    if (typeof navigator === "undefined") return 93;
    const m = navigator.userAgent.match(/(?:Chrome|Firefox)\/([\d]+)/);
    return m && m[1] ? parseInt(m[1], 10) : 93;
  }
  const isMobile = typeof navigator !== "undefined" && /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
  const INITIAL_OPTIONS = { ...DEFAULT_OPTIONS };
  const useSettingsStore = create((set, get) => ({
    initSyncComplete: false,
    initLocalComplete: false,
    tabId: -1,
    isMobile,
    isFirefox,
    version: detectVersion(),
    // 编译默认值
    Ext: toExtMap(DEFAULT_EXT_RULES),
    Type: toTypeMap(DEFAULT_TYPE_RULES),
    Regex: compileRegex(DEFAULT_REGEX_RULES),
    blockUrl: compileBlockUrl([]),
    options: INITIAL_OPTIONS,
    featMobileTabId: /* @__PURE__ */ new Set(),
    featAutoDownTabId: /* @__PURE__ */ new Set(),
    mediaControl: { ...DEFAULT_LOCAL_VAR.mediaControl },
    previewShowTitle: false,
    previewDeleteDuplicateFilenames: false,
    M3u8HideDownloadedSegments: true,
    enable: true,
    damnUrl: DEFAULT_DAMN_URL_PATTERNS,
    damnUrlSet: /* @__PURE__ */ new Set(),
    blockUrlSet: /* @__PURE__ */ new Set(),
    blockUrlWhite: false,
    scriptList: new Map(
      DEFAULT_SCRIPT_LIST.map(([name, entry]) => [
        name,
        { ...entry, tabId: /* @__PURE__ */ new Set() }
      ])
    ),
    ffmpegConfig: createFfmpegConfig(0),
    deepSearchTemporarilyClose: null,
    setTabId: (id) => set({ tabId: id }),
    setEnable: (v) => {
      set({ enable: v, options: { ...get().options, enable: v } });
      void chrome.storage.sync.set({ enable: v });
      chrome.action.setIcon({
        path: v ? "/img/icon.png" : "/img/icon-disable.png"
      });
    },
    setInitSyncComplete: (v) => set({ initSyncComplete: v }),
    setInitLocalComplete: (v) => set({ initLocalComplete: v }),
    setExtRules: (rules) => set({ Ext: toExtMap(rules) }),
    setTypeRules: (rules) => set({ Type: toTypeMap(rules) }),
    setRegexRules: (rules) => set({ Regex: compileRegex(rules) }),
    setBlockUrl: (rules) => set({ blockUrl: compileBlockUrl(rules) }),
    updateOptions: (patch) => set((s) => ({ options: { ...s.options, ...patch } })),
    addBlockUrlTab: (tabId) => set((s) => {
      const next = new Set(s.blockUrlSet);
      next.add(tabId);
      return { blockUrlSet: next };
    }),
    removeBlockUrlTab: (tabId) => set((s) => {
      const next = new Set(s.blockUrlSet);
      next.delete(tabId);
      return { blockUrlSet: next };
    }),
    addDamnUrlTab: (tabId) => set((s) => {
      const next = new Set(s.damnUrlSet);
      next.add(tabId);
      return { damnUrlSet: next };
    }),
    removeDamnUrlTab: (tabId) => set((s) => {
      const next = new Set(s.damnUrlSet);
      next.delete(tabId);
      return { damnUrlSet: next };
    }),
    addFeatMobileTab: (tabId) => set((s) => {
      const next = new Set(s.featMobileTabId);
      next.add(tabId);
      return { featMobileTabId: next };
    }),
    removeFeatMobileTab: (tabId) => set((s) => {
      const next = new Set(s.featMobileTabId);
      next.delete(tabId);
      return { featMobileTabId: next };
    }),
    addFeatAutoDownTab: (tabId) => set((s) => {
      const next = new Set(s.featAutoDownTabId);
      next.add(tabId);
      return { featAutoDownTabId: next };
    }),
    removeFeatAutoDownTab: (tabId) => set((s) => {
      const next = new Set(s.featAutoDownTabId);
      next.delete(tabId);
      return { featAutoDownTabId: next };
    }),
    setDeepSearchClose: (v) => set({ deepSearchTemporarilyClose: v }),
    toggleScriptTab: (script, tabId) => {
      const s = get();
      const entry = s.scriptList.get(script);
      if (!entry) return false;
      const next = new Map(s.scriptList);
      const nextEntry = { ...entry, tabId: new Set(entry.tabId) };
      if (nextEntry.tabId.has(tabId)) {
        nextEntry.tabId.delete(tabId);
      } else {
        nextEntry.tabId.add(tabId);
      }
      next.set(script, nextEntry);
      set({ scriptList: next });
      return true;
    },
    hasScriptTab: (script, tabId) => {
      const entry = get().scriptList.get(script);
      return entry ? entry.tabId.has(tabId) : false;
    },
    loadFromSync: async () => {
      const data = await chrome.storage.sync.get({
        ...DEFAULT_OPTIONS,
        Ext: DEFAULT_EXT_RULES,
        Type: DEFAULT_TYPE_RULES,
        Regex: DEFAULT_REGEX_RULES,
        blockUrl: []
      });
      for (const key in DEFAULT_OPTIONS) {
        if (data[key] === void 0 || data[key] === null) {
          data[key] = DEFAULT_OPTIONS[key];
        }
      }
      const patch = {
        Ext: toExtMap(data.Ext ?? DEFAULT_EXT_RULES),
        Type: toTypeMap(data.Type ?? DEFAULT_TYPE_RULES),
        Regex: compileRegex(data.Regex ?? DEFAULT_REGEX_RULES),
        blockUrl: compileBlockUrl(data.blockUrl ?? []),
        options: { ...DEFAULT_OPTIONS, ...data },
        enable: data.enable ?? true,
        blockUrlWhite: data.blockUrlWhite ?? false,
        initSyncComplete: true
      };
      set(patch);
      if (!isFirefox) {
        try {
          await chrome.sidePanel.setPanelBehavior({
            openPanelOnActionClick: data.sidePanel ?? false
          });
        } catch {
        }
      }
    },
    loadFromLocal: async () => {
      const area = chrome.storage.session ?? chrome.storage.local;
      const data = await area.get({
        ...DEFAULT_LOCAL_VAR
      });
      set({
        featMobileTabId: new Set(data.featMobileTabId ?? []),
        featAutoDownTabId: new Set(data.featAutoDownTabId ?? []),
        mediaControl: data.mediaControl ?? DEFAULT_LOCAL_VAR.mediaControl,
        previewShowTitle: data.previewShowTitle ?? false,
        previewDeleteDuplicateFilenames: data.previewDeleteDuplicateFilenames ?? false,
        M3u8HideDownloadedSegments: data.M3u8HideDownloadedSegments ?? true,
        initLocalComplete: true
      });
    },
    persistOptions: async () => {
      const { Ext, Type, Regex, blockUrl, options } = get();
      const { blockUrl: _drop, ...restOptions } = options;
      await chrome.storage.sync.set({
        Ext: Array.from(Ext.values()),
        Type: Array.from(Type.values()),
        Regex: Regex.map((r) => ({
          type: r.regex.flags.includes("g") ? r.regex.flags.includes("i") ? "ig" : "g" : r.regex.flags.includes("i") ? "i" : "",
          regex: r.regex.source,
          ext: r.ext,
          blackList: r.blackList,
          state: r.state
        })),
        blockUrl: blockUrl.map((r) => ({
          url: r.url.source,
          state: r.state
        })),
        ...restOptions
      });
    }
  }));
  const INITIAL = {
    buckets: /* @__PURE__ */ new Map(),
    initialized: true
    // 默认 true,SW 重启时会被 loadFromStorage 重置
  };
  const useMediaStore = create((set, get) => ({
    ...INITIAL,
    push: (item) => {
      const { buckets, initialized } = get();
      if (!initialized) return false;
      const next = new Map(buckets);
      const list = next.get(item.tabId) ?? [];
      if (list.some((m) => m.requestId === item.requestId && m.url === item.url)) {
        return false;
      }
      next.set(item.tabId, [...list, item]);
      set({ buckets: next });
      return true;
    },
    remove: (tabId, requestId) => set((s) => {
      const list = s.buckets.get(tabId);
      if (!list) return s;
      const next = new Map(s.buckets);
      const filtered = list.filter((m) => m.requestId !== requestId);
      if (filtered.length === 0) {
        next.delete(tabId);
      } else {
        next.set(tabId, filtered);
      }
      return { buckets: next };
    }),
    clearTab: (tabId) => set((s) => {
      if (!s.buckets.has(tabId)) return s;
      const next = new Map(s.buckets);
      next.delete(tabId);
      return { buckets: next };
    }),
    clearOtherTabs: (keepTabId) => set((s) => {
      const next = /* @__PURE__ */ new Map();
      const keep = s.buckets.get(keepTabId);
      if (keep) next.set(keepTabId, keep);
      return { buckets: next };
    }),
    clearAll: () => set({ buckets: /* @__PURE__ */ new Map() }),
    getByTab: (tabId) => get().buckets.get(tabId) ?? [],
    getByRequestIds: (requestIds) => {
      const result2 = [];
      const set_ = new Set(requestIds);
      for (const list of get().buckets.values()) {
        for (const m of list) {
          if (set_.has(m.requestId)) result2.push(m);
        }
      }
      return result2;
    },
    getAll: () => {
      const obj = {};
      for (const [k, v] of get().buckets) obj[k] = v;
      return obj;
    },
    loadFromStorage: async () => {
      var _a2;
      const area = chrome.storage.session ?? chrome.storage.local;
      const data = await area.get("MediaData");
      if ((_a2 = data.MediaData) == null ? void 0 : _a2.init) {
        set({ buckets: /* @__PURE__ */ new Map(), initialized: true });
        return;
      }
      const buckets = /* @__PURE__ */ new Map();
      if (data.MediaData) {
        const raw = data.MediaData.buckets ?? data.MediaData;
        for (const key in raw) {
          const tabId = Number(key);
          if (!Number.isNaN(tabId) && Array.isArray(raw[key])) {
            buckets.set(tabId, raw[key]);
          }
        }
      }
      set({ buckets, initialized: true });
    },
    persist: async () => {
      const { buckets } = get();
      const obj = {};
      for (const [k, v] of buckets) obj[k] = v;
      const area = chrome.storage.session ?? chrome.storage.local;
      await area.set({ MediaData: { buckets: obj, init: false } });
    },
    forcePersist: async () => get().persist(),
    setInitialized: (v) => set({ initialized: v }),
    toggleSelected: (tabId, requestId) => set((s) => {
      const list = s.buckets.get(tabId);
      if (!list) return s;
      const idx = list.findIndex((m) => m.requestId === requestId);
      if (idx === -1) return s;
      const item = list[idx];
      if (!item) return s;
      const nextList = list.slice();
      nextList[idx] = { ...item, selected: !item.selected };
      const next = new Map(s.buckets);
      next.set(tabId, nextList);
      return { buckets: next };
    }),
    setSelectedAll: (tabId, value) => set((s) => {
      const list = s.buckets.get(tabId);
      if (!list || list.length === 0) return s;
      const nextList = list.map((m) => ({ ...m, selected: value }));
      const next = new Map(s.buckets);
      next.set(tabId, nextList);
      return { buckets: next };
    }),
    invertSelection: (tabId) => set((s) => {
      const list = s.buckets.get(tabId);
      if (!list || list.length === 0) return s;
      const nextList = list.map((m) => ({ ...m, selected: !m.selected }));
      const next = new Map(s.buckets);
      next.set(tabId, nextList);
      return { buckets: next };
    })
  }));
  const useRuntimeStore = create((set, get) => ({
    urlMap: /* @__PURE__ */ new Map(),
    requestHeaders: /* @__PURE__ */ new Map(),
    blackList: /* @__PURE__ */ new Set(),
    debounceTimer: void 0,
    debounceCount: 0,
    debounceTime: 0,
    hasUrl: (tabId, url) => {
      var _a2;
      return ((_a2 = get().urlMap.get(tabId)) == null ? void 0 : _a2.has(url)) ?? false;
    },
    addUrl: (tabId, url, maxBucketSize = 500) => {
      const next = new Map(get().urlMap);
      let bucket = next.get(tabId) ?? /* @__PURE__ */ new Set();
      if (bucket.has(url)) return;
      bucket = new Set(bucket);
      bucket.add(url);
      if (bucket.size >= maxBucketSize) bucket.clear();
      next.set(tabId, bucket);
      set({ urlMap: next });
    },
    clearTabUrls: (tabId) => set((s) => {
      if (!s.urlMap.has(tabId)) return s;
      const next = new Map(s.urlMap);
      next.delete(tabId);
      return { urlMap: next };
    }),
    setRequestHeaders: (requestId, headers) => set((s) => {
      const next = new Map(s.requestHeaders);
      next.set(requestId, headers);
      return { requestHeaders: next };
    }),
    getRequestHeaders: (requestId) => get().requestHeaders.get(requestId),
    deleteRequestHeaders: (requestId) => set((s) => {
      if (!s.requestHeaders.has(requestId)) return s;
      const next = new Map(s.requestHeaders);
      next.delete(requestId);
      return { requestHeaders: next };
    }),
    addBlackList: (requestId) => set((s) => {
      const next = new Set(s.blackList);
      next.add(requestId);
      return { blackList: next };
    }),
    hasBlackList: (requestId) => get().blackList.has(requestId),
    deleteBlackList: (requestId) => set((s) => {
      if (!s.blackList.has(requestId)) return s;
      const next = new Set(s.blackList);
      next.delete(requestId);
      return { blackList: next };
    }),
    clearAll: () => set({
      urlMap: /* @__PURE__ */ new Map(),
      requestHeaders: /* @__PURE__ */ new Map(),
      blackList: /* @__PURE__ */ new Set()
    }),
    setDebounce: (timer, count = 0, time = 0) => set({ debounceTimer: timer, debounceCount: count, debounceTime: time }),
    pruneRequestHeaders: () => set((s) => {
      if (s.requestHeaders.size < 10240) return s;
      return { requestHeaders: /* @__PURE__ */ new Map() };
    })
  }));
  const reFilename = /filename="?([^"]+)"?/;
  function operatorCheck(size, obj) {
    const unitNumber = {
      B: 1,
      BYTE: 1,
      KB: 1024,
      MB: 1048576,
      GB: 1073741824
    };
    const unit = obj.unit || "B";
    const factor = unitNumber[unit] ?? 1;
    const targetSize = Number(obj.size) * factor;
    switch (obj.operator) {
      case "=":
        return size === targetSize;
      case "<":
        return (size ?? 0) < targetSize;
      case ">":
        return (size ?? 0) > targetSize;
      case "<=":
        return (size ?? 0) <= targetSize;
      case ">=":
        return (size ?? 0) >= targetSize;
      case "!=":
        return size !== targetSize;
      case "~":
        return (obj.min ? (size ?? 0) >= obj.min * factor : true) && (obj.max ? (size ?? 0) <= obj.max * factor : true);
      default:
        return (size ?? 0) <= targetSize;
    }
  }
  function CheckExtension(ext, size) {
    const G = useSettingsStore.getState();
    const rule = G.Ext.get(ext);
    if (!rule) return false;
    if (!rule.state) return "break";
    if (rule.size !== 0 && size !== void 0 && !operatorCheck(size, rule)) {
      return "break";
    }
    return true;
  }
  function CheckType(dataType, dataSize) {
    const G = useSettingsStore.getState();
    const typeInfo = G.Type.get(dataType.split("/")[0] + "/*") || G.Type.get(dataType);
    if (!typeInfo) return false;
    if (!typeInfo.state) return "break";
    if (typeInfo.size !== 0 && dataSize !== void 0 && !operatorCheck(dataSize, typeInfo)) {
      return "break";
    }
    return true;
  }
  function fileNameParse(pathname) {
    let fileName = "";
    try {
      fileName = decodeURI(pathname.split("/").pop() || "");
    } catch {
      fileName = pathname.split("/").pop() || "";
    }
    const parts = fileName.split(".");
    const ext = parts.length === 1 ? void 0 : parts.pop().toLowerCase();
    return [fileName, ext];
  }
  function getResponseHeadersValue(data) {
    const header = {};
    if (!data.responseHeaders || data.responseHeaders.length === 0) return header;
    for (const item of data.responseHeaders) {
      const name = item.name.toLowerCase();
      if (name === "content-length") {
        if (header.size === void 0) header.size = parseInt(item.value ?? "0", 10);
      } else if (name === "content-type") {
        header.type = ((item.value ?? "").split(";")[0] ?? "").toLowerCase();
      } else if (name === "content-disposition") {
        header.attachment = item.value;
      } else if (name === "content-range") {
        const size = (item.value ?? "").split("/")[1];
        if (size !== "*" && size !== void 0) {
          header.size = parseInt(size, 10);
        }
      }
    }
    return header;
  }
  const DIRECT_INCLUDE_HEADERS = /* @__PURE__ */ new Set([
    "referer",
    "origin",
    "cookie",
    "authorization",
    "auth",
    "token",
    "key",
    "access-token",
    "api-key",
    "app-token",
    "authtoken",
    "session-id"
  ]);
  const X_AUTH_KEYWORD_REG = /(auth|token|sign|key|ticket|session)/;
  function getRequestHeaders(data) {
    if (!(data == null ? void 0 : data.allRequestHeaders)) return false;
    const header = {};
    if (Array.isArray(data.allRequestHeaders)) {
      for (const item of data.allRequestHeaders) {
        if (!item.name || !item.value) continue;
        const lowerName = item.name.toLowerCase();
        if (DIRECT_INCLUDE_HEADERS.has(lowerName)) {
          header[lowerName] = item.value;
          continue;
        }
        if (lowerName.startsWith("x-") && X_AUTH_KEYWORD_REG.test(lowerName)) {
          header[lowerName] = item.value;
        }
      }
    } else {
      for (const [name, value] of Object.entries(data.allRequestHeaders)) {
        const lowerName = name.toLowerCase();
        if (DIRECT_INCLUDE_HEADERS.has(lowerName) || lowerName.startsWith("x-") && X_AUTH_KEYWORD_REG.test(lowerName)) {
          header[lowerName] = value;
        }
      }
    }
    return Object.keys(header).length > 0 ? header : false;
  }
  function parseAttachmentFilename(attachment) {
    const match = reFilename.exec(attachment);
    if (!match || !match[1]) return null;
    let decoded = "";
    try {
      decoded = decodeURIComponent(match[1]);
    } catch {
      decoded = match[1];
    }
    return fileNameParse(decoded);
  }
  function SetIcon(obj) {
    const G = useSettingsStore.getState();
    const tabId = (obj == null ? void 0 : obj.tabId) ?? G.tabId;
    if (!obj || obj.number === 0 || obj.number === void 0) {
      chrome.action.setBadgeText({ text: "", tabId });
      return;
    }
    if (G.options.badgeNumber) {
      const text = obj.number > 999 ? "999+" : String(obj.number);
      chrome.action.setBadgeText({ text, tabId });
    }
  }
  function mobileUserAgent(tabId, change = false) {
    const settings = useSettingsStore.getState();
    const area = chrome.storage.session ?? chrome.storage.local;
    if (change) {
      settings.addFeatMobileTab(tabId);
      const nextSet2 = useSettingsStore.getState().featMobileTabId;
      void area.set({ featMobileTabId: Array.from(nextSet2) });
      chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [tabId],
        addRules: [
          {
            id: tabId,
            action: {
              type: "modifyHeaders",
              requestHeaders: [
                {
                  header: "User-Agent",
                  operation: "set",
                  value: settings.options.MobileUserAgent
                }
              ]
            },
            condition: {
              tabIds: [tabId],
              resourceTypes: Object.values(
                chrome.declarativeNetRequest.ResourceType
              )
            }
          }
        ]
      });
      return;
    }
    settings.removeFeatMobileTab(tabId);
    const nextSet = useSettingsStore.getState().featMobileTabId;
    void area.set({ featMobileTabId: Array.from(nextSet) });
    chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [tabId] });
  }
  function isSpecialPage(url) {
    if (!url || url === "null") return true;
    return !(url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:"));
  }
  function clearRedundant() {
    const G = useSettingsStore.getState();
    chrome.tabs.query({}, (tabs) => {
      const allTabId = new Set(tabs.map((t) => t.id));
      const media = useMediaStore.getState();
      const runtime = useRuntimeStore.getState();
      let cacheChanged = false;
      const nextBuckets = new Map(media.buckets);
      for (const key of nextBuckets.keys()) {
        if (!allTabId.has(key)) {
          nextBuckets.delete(key);
          cacheChanged = true;
        }
      }
      if (cacheChanged) {
        useMediaStore.setState({ buckets: nextBuckets });
        void media.persist();
      }
      const nextUrlMap = new Map(runtime.urlMap);
      let urlMapChanged = false;
      for (const key of nextUrlMap.keys()) {
        if (!allTabId.has(key)) {
          nextUrlMap.delete(key);
          urlMapChanged = true;
        }
      }
      if (urlMapChanged) useRuntimeStore.setState({ urlMap: nextUrlMap });
      const nextScriptList = new Map(G.scriptList);
      let scriptChanged = false;
      for (const [name, entry] of nextScriptList) {
        const nextTabId = new Set(entry.tabId);
        let entryChanged = false;
        for (const tid of entry.tabId) {
          if (!allTabId.has(tid)) {
            nextTabId.delete(tid);
            entryChanged = true;
          }
        }
        if (entryChanged) {
          nextScriptList.set(name, { ...entry, tabId: nextTabId });
          scriptChanged = true;
        }
      }
      if (scriptChanged) useSettingsStore.setState({ scriptList: nextScriptList });
      if (!G.initLocalComplete) return;
      chrome.declarativeNetRequest.getSessionRules((rules) => {
        let mobileFlag = false;
        const tabsToRemove = [];
        for (const item of rules) {
          if (item.condition.tabIds) {
            if (!item.condition.tabIds.some((id) => allTabId.has(id))) {
              mobileFlag = true;
              item.condition.tabIds.forEach((id) => tabsToRemove.push(id));
              chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [item.id]
              });
            }
          } else if (item.id === 1) {
            chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: [1] });
          }
        }
        if (mobileFlag) {
          const settings = useSettingsStore.getState();
          const nextMobile = new Set(settings.featMobileTabId);
          for (const id of tabsToRemove) nextMobile.delete(id);
          useSettingsStore.setState({ featMobileTabId: nextMobile });
          const area = chrome.storage.session ?? chrome.storage.local;
          void area.set({ featMobileTabId: Array.from(nextMobile) });
        }
      });
      let autoDownFlag = false;
      const nextAuto = new Set(G.featAutoDownTabId);
      for (const tid of G.featAutoDownTabId) {
        if (!allTabId.has(tid)) {
          nextAuto.delete(tid);
          autoDownFlag = true;
        }
      }
      if (autoDownFlag) {
        useSettingsStore.setState({ featAutoDownTabId: nextAuto });
        const area = chrome.storage.session ?? chrome.storage.local;
        void area.set({ featAutoDownTabId: Array.from(nextAuto) });
      }
      const nextBlock = new Set([...G.blockUrlSet].filter((x) => allTabId.has(x)));
      const nextDamn = new Set([...G.damnUrlSet].filter((x) => allTabId.has(x)));
      useSettingsStore.setState({
        blockUrlSet: nextBlock,
        damnUrlSet: nextDamn
      });
      if (runtime.requestHeaders.size >= 10240) {
        runtime.requestHeaders.clear();
      }
    });
  }
  const _Template = class _Template {
    static render(text, data) {
      var _a2, _b2, _c2;
      if (isEmpty(text)) return "";
      try {
        data.fullFileName = new URL(data.url ?? "").pathname.split("/").pop() || "";
      } catch {
        data.fullFileName = "NULL";
      }
      const parts = data.fullFileName.split(".");
      if (parts.length > 1) parts.pop();
      data.fileName = parts.join(".");
      if (isEmpty(data.ext)) {
        const extParts = data.fullFileName.split(".");
        data.ext = extParts.length === 1 ? "" : extParts[extParts.length - 1];
      }
      const date = /* @__PURE__ */ new Date();
      const trimData = {
        url: data.url ?? "",
        referer: ((_a2 = data.requestHeaders) == null ? void 0 : _a2.referer) ?? "",
        origin: ((_b2 = data.requestHeaders) == null ? void 0 : _b2.origin) ?? "",
        initiator: ((_c2 = data.requestHeaders) == null ? void 0 : _c2.referer) ? data.requestHeaders.referer : data.initiator,
        webUrl: data.webUrl ?? "",
        title: data._title || data.title || "NULL",
        pageDOM: data.pageDOM,
        cookie: data.cookie ?? "",
        tabId: data.tabId ?? 0,
        year: date.getFullYear(),
        month: appendZero(date.getMonth() + 1),
        date: appendZero(date.getDate()),
        day: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()],
        fullDate: `${date.getFullYear()}-${appendZero(date.getMonth() + 1)}-${appendZero(date.getDate())}`,
        time: `${appendZero(date.getHours())}'${appendZero(date.getMinutes())}'${appendZero(date.getSeconds())}`,
        hours: appendZero(date.getHours()),
        minutes: appendZero(date.getMinutes()),
        seconds: appendZero(date.getSeconds()),
        now: Date.now(),
        timestamp: date.toISOString(),
        fullFileName: data.fullFileName,
        fileName: data.fileName ?? "",
        ext: data.ext ?? "",
        mobileUserAgent: data.mobileUserAgent ?? "",
        userAgent: data.userAgent ?? ""
      };
      trimData.title = String(trimData.title).replace(/[/\\]/g, "_");
      const _data = { ...data, ...trimData };
      const ast = this._parse(String(text));
      return this._evaluate(ast, _data, trimData);
    }
    // ========== 解析阶段(还原 templates.js 第 91-206 行) ==========
    static _parse(input) {
      const nodes = [];
      let pos = 0;
      const peek = (offset = 0) => pos + offset < input.length ? input[pos + offset] : "";
      const advance = () => pos < input.length ? input[pos++] : "";
      const eof = () => pos >= input.length;
      const readBalancedContent = () => {
        let depth = 1;
        const start = pos;
        let inDouble = false;
        let inSingle = false;
        let escaped = false;
        while (!eof() && depth > 0) {
          const ch = advance();
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === "\\") {
            escaped = true;
            continue;
          }
          if (!inSingle && ch === '"') inDouble = !inDouble;
          else if (!inDouble && ch === "'") inSingle = !inSingle;
          else if (!inDouble && !inSingle) {
            if (ch === "$" && peek() === "{") depth++;
            else if (ch === "}") {
              depth--;
              if (depth === 0) return input.slice(start, pos - 1);
            }
          }
        }
        return input.slice(start, pos);
      };
      const splitByTopLevelPipe = (str) => {
        const parts = [];
        let start = 0;
        let inDouble = false;
        let inSingle = false;
        let escaped = false;
        for (let i = 0; i < str.length; i++) {
          const ch = str[i];
          if (escaped) {
            escaped = false;
            continue;
          }
          if (ch === "\\") {
            escaped = true;
            continue;
          }
          if (!inSingle && ch === '"') inDouble = !inDouble;
          else if (!inDouble && ch === "'") inSingle = !inSingle;
          else if (!inDouble && !inSingle && ch === "|") {
            parts.push(str.slice(start, i));
            start = i + 1;
          }
        }
        parts.push(str.slice(start));
        return parts;
      };
      const parseOnePipe = (pipeStr) => {
        const colonIdx = pipeStr.indexOf(":");
        let name;
        let argsRaw;
        if (colonIdx === -1) {
          name = pipeStr.trim();
          argsRaw = "";
        } else {
          name = pipeStr.slice(0, colonIdx).trim();
          argsRaw = pipeStr.slice(colonIdx + 1).trim();
        }
        const argStrings = argsRaw ? _Template._splitString(argsRaw, ",") : [];
        const args = argStrings.map((arg) => {
          const cleanArg = arg.trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
          if (cleanArg.includes("${")) {
            return _Template._parse(cleanArg);
          }
          return { type: "text", value: cleanArg };
        });
        return { name, args };
      };
      const parsePipeChain = (chainStr) => splitByTopLevelPipe(chainStr).map((s) => parseOnePipe(s.trim()));
      const parseTag = () => {
        advance();
        advance();
        const content = readBalancedContent();
        const pipeIdx = (() => {
          let inD = false, inS = false, esc = false;
          for (let i = 0; i < content.length; i++) {
            const ch = content[i];
            if (esc) {
              esc = false;
              continue;
            }
            if (ch === "\\") {
              esc = true;
              continue;
            }
            if (!inS && ch === '"') inD = !inD;
            else if (!inD && ch === "'") inS = !inS;
            else if (!inD && !inS && ch === "|") return i;
          }
          return -1;
        })();
        const varName = pipeIdx === -1 ? content.trim() : content.slice(0, pipeIdx).trim();
        const pipes = pipeIdx === -1 ? [] : parsePipeChain(content.slice(pipeIdx + 1).trim());
        return { type: "tag", varName, pipes };
      };
      while (pos < input.length) {
        if (peek() === "$" && peek(1) === "{") {
          nodes.push(parseTag());
        } else {
          const start = pos;
          while (!eof() && !(peek() === "$" && peek(1) === "{")) advance();
          nodes.push({ type: "text", value: input.slice(start, pos) });
        }
      }
      return nodes;
    }
    // ========== 求值阶段(还原 templates.js 第 209-254 行) ==========
    static _evaluate(nodes, data, trimData) {
      let result2 = "";
      for (const node of nodes) {
        if (node.type === "text") {
          result2 += node.value ?? "";
        } else if (node.type === "tag") {
          result2 += this._evalTag(node, data, trimData);
        }
      }
      return result2;
    }
    static _evalTag(tag, data, trimData) {
      let value;
      if (tag.varName === "data") {
        const {
          pageDOM,
          year,
          month,
          date,
          day,
          fullDate,
          time,
          hours,
          minutes,
          seconds,
          mobileUserAgent: mobileUserAgent2,
          ...rest
        } = trimData;
        value = JSON.stringify(rest);
      } else {
        value = data[tag.varName];
      }
      let current = value !== void 0 ? String(value) : "";
      if (!tag.pipes.length) {
        return value !== void 0 ? String(value) : "${" + tag.varName + "}";
      }
      for (const pipe of tag.pipes) {
        const resolvedArgs = pipe.args.map((arg) => {
          if (Array.isArray(arg)) {
            return this._evaluate(arg, data, trimData);
          }
          if (arg && arg.type === "text") return arg.value;
          return arg;
        });
        if (isEmpty(current) && !["exists", "find", "prompt"].includes(pipe.name)) return "";
        if (resolvedArgs.length === 0 && !["filter", "prompt"].includes(pipe.name)) break;
        const processor = _Template._processors[pipe.name];
        if (processor) {
          current = processor(current, resolvedArgs, data);
        }
      }
      return current;
    }
    /** 字符串分割辅助(还原 templates.js 第 257-274 行) */
    static _splitString(text, separator) {
      text = text.trim();
      if (text.length === 0) return [];
      const parts = [];
      let inQuotes = false;
      let inSingle = false;
      let start = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === separator && !inQuotes && !inSingle) {
          parts.push(text.slice(start, i));
          start = i + 1;
        } else if (text[i] === '"' && !inSingle) {
          inQuotes = !inQuotes;
        } else if (text[i] === "'" && !inQuotes) {
          inSingle = !inSingle;
        }
      }
      parts.push(text.slice(start));
      return parts;
    }
  };
  __publicField(_Template, "_processors", {
    slice: (txt, arg) => txt.slice(...arg),
    replace: (txt, arg) => txt.replace(...arg),
    replaceAll: (txt, arg) => txt.replaceAll(...arg),
    regexp: (txt, arg) => {
      const match = txt.match(new RegExp(...arg));
      if (!match) return "";
      return match.slice(1).filter(Boolean).map((s) => s.trim()).join("");
    },
    exists: (txt, arg) => {
      var _a2, _b2;
      const a = arg;
      return txt ? ((_a2 = a[0]) == null ? void 0 : _a2.replaceAll("*", txt)) ?? "" : ((_b2 = a[1]) == null ? void 0 : _b2.replaceAll("*", txt)) ?? "";
    },
    prepend: (txt, arg) => (arg[0] || "") + txt,
    concat: (txt, arg) => txt + (arg[0] || ""),
    to: (txt, arg) => {
      const type = arg[0];
      switch (type) {
        case "base64":
          try {
            return btoa(
              encodeURIComponent(txt).replace(
                /%([0-9A-F]{2})/g,
                (_, p1) => String.fromCharCode(parseInt(p1, 16))
              )
            );
          } catch {
            return txt;
          }
        case "urlEncode":
          return encodeURIComponent(txt);
        case "urlDecode":
          return decodeURIComponent(txt);
        case "lowerCase":
          return txt.toLowerCase();
        case "upperCase":
          return txt.toUpperCase();
        case "trim":
          return txt.trim();
        case "filter":
          return stringModify(txt.trim());
        default:
          return txt;
      }
    },
    find: (_txt, arg, data) => {
      var _a2, _b2;
      if ((data == null ? void 0 : data.pageDOM) && data.pageDOM instanceof Document) {
        try {
          return ((_b2 = (_a2 = data.pageDOM.querySelector(arg[0])) == null ? void 0 : _a2.textContent) == null ? void 0 : _b2.trim()) ?? "";
        } catch {
          return "";
        }
      }
      return "";
    },
    filter: (txt, arg) => stringModify(txt, arg[0]),
    prompt: (txt) => typeof window !== "undefined" ? window.prompt("", txt) || "" : txt
  });
  let Template = _Template;
  function templates(text, data) {
    return Template.render(text, data);
  }
  function appendZero(date) {
    return parseInt(String(date), 10) < 10 ? `0${date}` : date;
  }
  function isEmpty(obj) {
    return typeof obj === "undefined" || obj === null || obj === "" || obj === " ";
  }
  const reJSONparse = /([{,]\s*)([\w-]+)(\s*:)/g;
  function JSONparse(str, error = {}, attempt = 0) {
    if (!str) return error;
    try {
      return JSON.parse(str);
    } catch {
      if (attempt === 0) {
        reJSONparse.lastIndex = 0;
        const fixedStr = str.replace(reJSONparse, '$1"$2"$3');
        return JSONparse(fixedStr, error, ++attempt);
      }
      return error;
    }
  }
  const reFilterFileName = /[<>:"|?*~]/g;
  function filterFileName(str, text) {
    if (!str) return "";
    reFilterFileName.lastIndex = 0;
    str = str.replaceAll(/\u200B/g, "").replaceAll(/\u200C/g, "").replaceAll(/\u200D/g, "");
    str = str.replace(reFilterFileName, (match) => {
      if (text) return text;
      const map = {
        "<": "&lt;",
        ">": "&gt;",
        ":": "&colon;",
        '"': "&quot;",
        "|": "&vert;",
        "?": "&quest;",
        "*": "&ast;",
        "~": "_"
      };
      return map[match] ?? match;
    });
    if (str.endsWith(".")) str = str + "catCatch";
    if (str.startsWith(".")) str = "catCatch" + str;
    return str;
  }
  function stringModify(str, text) {
    if (!str) return str;
    str = filterFileName(str, text);
    str = str.replace(/[\\/]/g, (match) => {
      if (text) return text;
      return match === "\\" ? "&bsol;" : "&sol;";
    });
    return str;
  }
  function flattenObject(obj, prefix = "") {
    const result2 = {};
    for (const key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      const value = obj[key];
      const newKey = prefix ? `${prefix}[${key}]` : key;
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result2, flattenObject(value, newKey));
      } else {
        result2[newKey] = value;
      }
    }
    return result2;
  }
  function isDamnUrl(url) {
    const s = useSettingsStore.getState();
    for (const re of s.damnUrl) {
      re.lastIndex = 0;
      if (re.test(url)) return true;
    }
    return false;
  }
  function isLockUrl(url) {
    const s = useSettingsStore.getState();
    for (const rule of s.blockUrl) {
      if (!rule.state) continue;
      rule.url.lastIndex = 0;
      if (rule.url.test(url)) return true;
    }
    return false;
  }
  async function send2local(action, data, tabId = 0) {
    const G = useSettingsStore.getState();
    let body = G.options.send2localBody;
    let postData;
    if (action === "addKey" || typeof data === "string") {
      body = body.replaceAll("${data}", `"${data}"`);
      postData = { action, tabId };
    } else {
      data.action = action;
      postData = data;
    }
    const rendered = templates(body, { ...postData, tabId });
    return executeCoreRequest(JSONparse(rendered, postData), postData);
  }
  async function executeCoreRequest(postData, templateContext) {
    const G = useSettingsStore.getState();
    const option = { method: G.options.send2localMethod };
    try {
      let send2localURL = templates(G.options.send2localURL, templateContext);
      const parsedUrl = new URL(send2localURL);
      if (option.method === "GET") {
        const flattened = flattenObject(postData);
        const urlParams = new URLSearchParams();
        for (const [k, v] of Object.entries(flattened)) {
          urlParams.set(k, String(v));
        }
        parsedUrl.search = parsedUrl.search ? `${parsedUrl.search}&${urlParams.toString()}` : `?${urlParams.toString()}`;
      } else {
        const contentTypeMap = {
          0: "application/json;charset=utf-8",
          1: "multipart/form-data",
          2: "application/x-www-form-urlencoded",
          3: "text/plain"
        };
        const contentType = contentTypeMap[G.options.send2localType] ?? "application/json;charset=utf-8";
        option.headers = { "Content-Type": contentType };
        switch (contentType) {
          case "application/json;charset=utf-8":
            option.body = JSON.stringify(postData);
            break;
          case "multipart/form-data": {
            const formData = new FormData();
            const flattened = flattenObject(postData);
            for (const [k, v] of Object.entries(flattened)) {
              formData.append(k, String(v));
            }
            option.body = formData;
            delete option.headers["Content-Type"];
            break;
          }
          case "application/x-www-form-urlencoded": {
            const flattened = flattenObject(postData);
            const urlParams = new URLSearchParams();
            for (const [k, v] of Object.entries(flattened)) {
              urlParams.set(k, String(v));
            }
            option.body = urlParams.toString();
            break;
          }
          case "text/plain":
            option.body = JSON.stringify(postData);
            break;
        }
      }
      if (G.options.send2localHeaders) {
        const customHeaders = JSONparse(G.options.send2localHeaders, {});
        if (typeof customHeaders === "string") return await fetch(parsedUrl.toString(), option);
        if (!option.headers) option.headers = {};
        for (const key in customHeaders) {
          option.headers[key] = String(customHeaders[key]);
        }
      }
      return await fetch(parsedUrl.toString(), option);
    } catch (e) {
      throw e;
    }
  }
  function i18n(key, substitutions) {
    if (typeof chrome === "undefined" || !chrome.i18n) return key;
    return chrome.i18n.getMessage(key, substitutions) || key;
  }
  const definition = defineBackground(() => {
    var _a2, _b2;
    void (async () => {
      const s = useSettingsStore.getState();
      await Promise.all([s.loadFromSync(), s.loadFromLocal()]);
      await useMediaStore.getState().loadFromStorage();
      contextMenusInit();
    })();
    chrome.runtime.onInstalled.addListener(() => {
      contextMenusInit();
    });
    chrome.webNavigation.onBeforeNavigate.addListener(() => void 0);
    chrome.webNavigation.onHistoryStateUpdated.addListener(() => void 0);
    chrome.runtime.onConnect.addListener((port) => {
      if (chrome.runtime.lastError || port.name !== "HeartBeat") return;
      port.postMessage("HeartBeat");
      port.onMessage.addListener(() => void 0);
      const interval = setInterval(() => {
        clearInterval(interval);
        port.disconnect();
      }, 25e4);
      port.onDisconnect.addListener(() => {
        if (chrome.runtime.lastError) return;
      });
    });
    setInterval(() => chrome.runtime.getPlatformInfo(() => void 0), 25e3);
    chrome.webRequest.onSendHeaders.addListener(
      (data) => {
        const s = useSettingsStore.getState();
        if (s.initSyncComplete && !s.enable) return;
        if (data.requestHeaders) {
          const headers = {};
          for (const h of data.requestHeaders) headers[h.name] = h.value ?? "";
          useRuntimeStore.getState().setRequestHeaders(data.requestId, data.requestHeaders);
          data.allRequestHeaders = data.requestHeaders;
        }
        try {
          void findMedia(data, true);
        } catch (e) {
          console.error(e);
        }
      },
      { urls: ["<all_urls>"] },
      ["requestHeaders", "extraHeaders"]
    );
    chrome.webRequest.onResponseStarted.addListener(
      (data) => {
        try {
          const allHeaders = useRuntimeStore.getState().getRequestHeaders(data.requestId);
          if (allHeaders) {
            data.allRequestHeaders = allHeaders;
            useRuntimeStore.getState().deleteRequestHeaders(data.requestId);
          }
          void findMedia(data);
        } catch (e) {
          console.error(e, data);
        }
      },
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );
    chrome.webRequest.onErrorOccurred.addListener((data) => {
      useRuntimeStore.getState().deleteRequestHeaders(data.requestId);
      useRuntimeStore.getState().deleteBlackList(data.requestId);
    }, { urls: ["<all_urls>"] });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "nowClear" || alarm.name === "clear") {
        clearRedundant();
        return;
      }
      if (alarm.name === "save") {
        void useMediaStore.getState().persist();
      }
    });
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      var _a3;
      if (chrome.runtime.lastError) return;
      const s = useSettingsStore.getState();
      if (!s.initLocalComplete || !s.initSyncComplete) {
        sendResponse("error");
        return true;
      }
      const Message = msg == null ? void 0 : msg.Message;
      const tabId = (msg == null ? void 0 : msg.tabId) ?? s.tabId;
      if (Message === "pushData") {
        void useMediaStore.getState().forcePersist();
        sendResponse("ok");
        return true;
      }
      if (Message === "getAllData") {
        sendResponse(useMediaStore.getState().getAll());
        return true;
      }
      if (Message === "ClearIcon") {
        msg.type ? SetIcon({ tabId }) : SetIcon();
        sendResponse("ok");
        return true;
      }
      if (Message === "enable") {
        void s.setEnable(!s.enable);
        sendResponse(s.enable);
        return true;
      }
      if (Message === "getData" && msg.requestId) {
        const ids = Array.isArray(msg.requestId) ? msg.requestId : [msg.requestId];
        const response = useMediaStore.getState().getByRequestIds(ids);
        sendResponse(response.length ? response : "error");
        return true;
      }
      if (Message === "getData") {
        sendResponse(useMediaStore.getState().getByTab(tabId));
        return true;
      }
      if (Message === "getButtonState") {
        const state = {
          MobileUserAgent: s.featMobileTabId.has(tabId),
          AutoDown: s.featAutoDownTabId.has(tabId),
          enable: s.enable
        };
        s.scriptList.forEach((item) => {
          state[item.key] = item.tabId.has(tabId);
        });
        sendResponse(state);
        return true;
      }
      if (Message === "getVideoTabs") {
        const collectTabs = async (tabs) => {
          const result2 = [];
          await Promise.all(
            tabs.map(async (tab) => {
              if (!tab.id) return;
              try {
                const frames = await chrome.webNavigation.getAllFrames({ tabId: tab.id });
                let found = false;
                if (frames) {
                  await Promise.all(
                    frames.map(async (f) => {
                      if (found) return;
                      try {
                        const st = await chrome.tabs.sendMessage(
                          tab.id,
                          { Message: "getVideoState", index: 0 },
                          { frameId: f.frameId }
                        );
                        if (st && st.count > 0) {
                          found = true;
                          result2.push({
                            id: tab.id,
                            title: tab.title ?? "",
                            favIconUrl: tab.favIconUrl
                          });
                        }
                      } catch {
                      }
                    })
                  );
                }
              } catch {
                try {
                  const st = await chrome.tabs.sendMessage(tab.id, {
                    Message: "getVideoState",
                    index: 0
                  });
                  if (st && st.count > 0) {
                    result2.push({
                      id: tab.id,
                      title: tab.title ?? "",
                      favIconUrl: tab.favIconUrl
                    });
                  }
                } catch {
                }
              }
            })
          );
          return result2;
        };
        chrome.tabs.query({}, async (tabs) => {
          sendResponse(await collectTabs(tabs));
        });
        return true;
      }
      if (Message === "mobileUserAgent") {
        mobileUserAgent(tabId, !s.featMobileTabId.has(tabId));
        chrome.tabs.reload(tabId, { bypassCache: true });
        sendResponse("ok");
        return true;
      }
      if (Message === "autoDown") {
        if (s.featAutoDownTabId.has(tabId)) {
          s.removeFeatAutoDownTab(tabId);
        } else {
          s.addFeatAutoDownTab(tabId);
        }
        sendResponse("ok");
        return true;
      }
      if (Message === "script") {
        if (s.options.damn && s.damnUrlSet.has(tabId)) return;
        if (!s.scriptList.has(msg.script)) {
          sendResponse("error no exists");
          return false;
        }
        const entry = s.scriptList.get(msg.script);
        const refresh = msg.refresh ?? entry.refresh;
        if (entry.tabId.has(tabId)) {
          s.toggleScriptTab(msg.script, tabId);
          if (msg.script === "search.js") {
            s.setDeepSearchClose(tabId);
          }
          if (refresh) chrome.tabs.reload(tabId, { bypassCache: true });
          sendResponse("ok");
          return true;
        }
        s.toggleScriptTab(msg.script, tabId);
        if (refresh) {
          chrome.tabs.reload(tabId, { bypassCache: true });
        } else {
          const files = [`catch-script/${msg.script}`];
          if (entry.i18n) files.unshift("catch-script/i18n.js");
          chrome.scripting.executeScript({
            target: { tabId, allFrames: entry.allFrames },
            files,
            injectImmediately: true,
            world: entry.world
          }).catch((e) => console.error("[cat-catch] script inject failed:", msg.script, e));
        }
        sendResponse("ok");
        return true;
      }
      if (Message === "scriptI18n") {
        chrome.scripting.executeScript({
          target: { tabId, allFrames: true },
          files: ["catch-script/i18n.js"],
          injectImmediately: true,
          world: "MAIN"
        });
        sendResponse("ok");
        return true;
      }
      if (Message === "HeartBeat") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          var _a4;
          if ((_a4 = tabs[0]) == null ? void 0 : _a4.id) useSettingsStore.getState().setTabId(tabs[0].id);
        });
        sendResponse("HeartBeat OK");
        return true;
      }
      if (Message === "clearData") {
        const m = useMediaStore.getState();
        if (msg.type) {
          m.clearTab(tabId);
        } else {
          m.clearOtherTabs(tabId);
        }
        void m.persist();
        clearRedundant();
        sendResponse("OK");
        return true;
      }
      if (Message === "clearRedundant") {
        clearRedundant();
        sendResponse("OK");
        return true;
      }
      if (Message === "addMedia") {
        chrome.tabs.query({}, (tabs) => {
          let matchedTabId = -1;
          for (const t of tabs) {
            if (t.url === msg.href) {
              matchedTabId = t.id ?? -1;
              break;
            }
          }
          const data = {
            url: msg.url,
            tabId: matchedTabId === -1 ? -1 : matchedTabId,
            extraExt: msg.extraExt,
            mime: msg.mime,
            requestId: msg.requestId,
            requestHeaders: msg.requestHeaders,
            initiator: matchedTabId === -1 ? msg.href : void 0
          };
          void findMedia(data, true, true);
        });
        sendResponse("ok");
        return true;
      }
      if (Message === "catCatchFFmpeg") {
        const ffmpeg = useSettingsStore.getState().ffmpegConfig;
        const payload = {
          ...msg,
          Message: "ffmpeg",
          tabId: msg.tabId ?? ((_a3 = sender.tab) == null ? void 0 : _a3.id),
          version: ffmpeg.version
        };
        chrome.tabs.query({ url: ffmpeg.url + "*" }, (tabs) => {
          if (chrome.runtime.lastError || !tabs.length) {
            chrome.tabs.create({ url: ffmpeg.url, active: msg.active ?? true }, (tab) => {
              if (chrome.runtime.lastError || !tab || !tab.id) return;
              ffmpeg.cacheData.push(payload);
              ffmpeg.tab = tab.id;
            });
            return;
          }
          const first = tabs[0];
          if ((first == null ? void 0 : first.status) === "complete" && first.id) {
            void chrome.tabs.sendMessage(first.id, payload);
          } else if (first == null ? void 0 : first.id) {
            ffmpeg.tab = first.id;
            ffmpeg.cacheData.push(payload);
          }
        });
        sendResponse("ok");
        return true;
      }
      if (Message === "catCatchFFmpegResult") {
        if (msg.state === "done" && msg.file) {
          const title = msg.title || `cat-catch-ffmpeg-${Date.now()}`;
          const output = msg.output || "mp4";
          chrome.downloads.download({
            url: msg.file,
            filename: `${title}.${output}`,
            saveAs: false
          });
        }
        if (msg.tabId) {
          void chrome.tabs.sendMessage(msg.tabId, { Message: "catCatchFFmpegResult", ...msg }).catch(() => {
          });
        }
        sendResponse("ok");
        return true;
      }
      if (Message === "catDown") {
        const data = Array.isArray(msg.data) ? msg.data : [msg.data];
        const payload = data.map((d) => ({
          url: d.url,
          name: d.downFileName ?? d.name ?? "",
          requestHeaders: d.requestHeaders ?? {},
          requestId: d.requestId,
          tabId: d.tabId
        }));
        chrome.tabs.create({
          url: `downloader.html?JSON=${encodeURIComponent(JSON.stringify(payload))}&autoClose=true`,
          active: true
        });
        sendResponse("ok");
        return true;
      }
      if (Message === "send2local" && (s.options.send2local || s.options.send2localManual)) {
        try {
          void send2local(msg.action ?? "catch", msg.data, msg.tabId);
        } catch (e) {
          console.error(e);
        }
        sendResponse("ok");
        return true;
      }
      if (Message === "aria2" && s.options.enableAria2Rpc) {
        try {
          void aria2AddUri(msg.data);
        } catch (e) {
          console.error(e);
        }
        sendResponse("ok");
        return true;
      }
      if (Message === "invoke" && s.options.invoke) {
        try {
          const url = templates(s.options.invokeText, msg.data);
          const targetTabId = msg.tabId ?? tabId;
          if (targetTabId > 0) {
            chrome.tabs.update(targetTabId, { url });
          } else {
            chrome.tabs.update({ url });
          }
        } catch (e) {
          console.error(e);
        }
        sendResponse("ok");
        return true;
      }
      if (Message === "mqtt" && s.options.mqttEnable) {
        console.warn("[cat-catch] MQTT \u53D1\u9001\u9700\u5728 popup/preview \u7AEF\u8C03\u7528(\u4F9D\u8D56 mqtt.js \u5E93),background \u5DF2\u8BB0\u5F55:", msg.data);
        sendResponse("ok");
        return true;
      }
      if (Message === "damnUrlHas") {
        sendResponse(s.damnUrlSet.has(tabId));
        return true;
      }
      if (Message === "closeScript") {
        if (!msg.script || !s.scriptList.has(msg.script)) {
          sendResponse("error");
          return false;
        }
        s.toggleScriptTab(msg.script, tabId);
        sendResponse("ok");
        return true;
      }
      return;
    });
    chrome.runtime.onMessageExternal.addListener((request, _sender, sendResponse) => {
      const s = useSettingsStore.getState();
      if (request.action === "getData") {
        if (request.tabId) {
          sendResponse(useMediaStore.getState().getByTab(request.tabId) ?? null);
          return true;
        }
        sendResponse(useMediaStore.getState().getAll());
        return true;
      }
      if (request.action === "getCurrentTabData") {
        const tabId = request.tabId ?? s.tabId;
        sendResponse(useMediaStore.getState().getByTab(tabId) ?? null);
        return true;
      }
      return;
    });
    chrome.tabs.onActivated.addListener((activeInfo) => {
      useSettingsStore.getState().setTabId(activeInfo.tabId);
      const list = useMediaStore.getState().getByTab(activeInfo.tabId);
      SetIcon({ number: list.length, tabId: activeInfo.tabId });
    });
    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId === -1) return;
      chrome.tabs.query({ active: true, windowId }, (tabs) => {
        var _a3;
        if ((_a3 = tabs[0]) == null ? void 0 : _a3.id) {
          useSettingsStore.getState().setTabId(tabs[0].id);
        } else {
          useSettingsStore.getState().setTabId(-1);
        }
      });
    });
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      var _a3;
      const s = useSettingsStore.getState();
      if (isSpecialPage(tab.url) || tabId <= 0 || !s.initSyncComplete) return;
      if (changeInfo.status && changeInfo.status === "loading" && s.options.autoClearMode === 2) {
        useRuntimeStore.getState().clearTabUrls(tabId);
        chrome.alarms.get("save", (alarm) => {
          if (!alarm) {
            useMediaStore.getState().clearTab(tabId);
            SetIcon({ tabId });
            chrome.alarms.create("save", { when: Date.now() + 1e3 });
          }
        });
      }
      if (changeInfo.url && tabId > 0) {
        if (s.blockUrl.length) {
          if (isLockUrl(changeInfo.url)) {
            s.addBlockUrlTab(tabId);
          } else {
            s.removeBlockUrlTab(tabId);
          }
        }
        if (isDamnUrl(changeInfo.url)) {
          s.addDamnUrlTab(tabId);
        } else {
          s.removeDamnUrlTab(tabId);
        }
      }
      try {
        void ((_a3 = chrome.sidePanel) == null ? void 0 : _a3.setOptions({
          tabId,
          path: `popup.html?tabId=${tabId}`
        }));
      } catch {
      }
    });
    chrome.webNavigation.onCommitted.addListener((details) => {
      const s = useSettingsStore.getState();
      if (isSpecialPage(details.url) || details.tabId <= 0 || !s.initSyncComplete) return;
      if (details.frameId === 0) {
        if (isLockUrl(details.url)) {
          s.addBlockUrlTab(details.tabId);
        } else {
          s.removeBlockUrlTab(details.tabId);
        }
        if (isDamnUrl(details.url)) {
          s.addDamnUrlTab(details.tabId);
        } else {
          s.removeDamnUrlTab(details.tabId);
        }
      }
      const skipTransitions = ["auto_subframe", "manual_subframe", "form_submit"];
      if (details.frameId === 0 && !skipTransitions.includes(details.transitionType) && s.options.autoClearMode === 1) {
        useMediaStore.getState().clearTab(details.tabId);
        useRuntimeStore.getState().clearTabUrls(details.tabId);
        void useMediaStore.getState().persist();
        SetIcon({ tabId: details.tabId });
      }
      if (s.version < 102) return;
      if (!s.blockUrlSet.has(details.tabId) && s.options.deepSearch && s.deepSearchTemporarilyClose !== details.tabId) {
        s.toggleScriptTab("search.js", details.tabId);
        s.setDeepSearchClose(null);
      }
      s.scriptList.forEach((entry, script) => {
        if (!entry.tabId.has(details.tabId) || !entry.allFrames) return;
        const files = [`catch-script/${script}`];
        if (entry.i18n) files.unshift("catch-script/i18n.js");
        chrome.scripting.executeScript({
          target: { tabId: details.tabId, frameIds: [details.frameId] },
          files,
          injectImmediately: true,
          world: entry.world
        });
      });
      if (s.initLocalComplete && s.featMobileTabId.size > 0 && s.featMobileTabId.has(details.tabId)) {
        chrome.scripting.executeScript({
          args: [s.options.MobileUserAgent.toString()],
          target: { tabId: details.tabId, frameIds: [details.frameId] },
          func: function() {
            Object.defineProperty(navigator, "userAgent", {
              value: arguments[0],
              writable: false
            });
          },
          injectImmediately: true,
          world: "MAIN"
        });
      }
    });
    chrome.tabs.onRemoved.addListener((tabId) => {
      chrome.alarms.get("nowClear", (alarm) => {
        if (!alarm) {
          chrome.alarms.create("nowClear", { when: Date.now() + 1e3 });
        }
      });
      const s = useSettingsStore.getState();
      if (s.initSyncComplete) {
        if (s.blockUrlSet.has(tabId)) s.removeBlockUrlTab(tabId);
        if (s.damnUrlSet.has(tabId)) s.removeDamnUrlTab(tabId);
      }
    });
    chrome.webNavigation.onCompleted.addListener((details) => {
      const s = useSettingsStore.getState();
      if (s.ffmpegConfig.tab && details.tabId === s.ffmpegConfig.tab) {
        setTimeout(() => {
          const cache = s.ffmpegConfig.cacheData;
          for (const data of cache) {
            void chrome.tabs.sendMessage(details.tabId, data);
          }
          s.ffmpegConfig.cacheData.length = 0;
          s.ffmpegConfig.tab = 0;
        }, 500);
      }
    });
    chrome.downloads.onChanged.addListener((item) => {
      const s = useSettingsStore.getState();
      if (s.options.catDownload) {
        downDataImageSave = void 0;
        return;
      }
      const errorList = [
        "SERVER_BAD_CONTENT",
        "SERVER_UNAUTHORIZED",
        "SERVER_FORBIDDEN",
        "SERVER_UNREACHABLE",
        "SERVER_CROSS_ORIGIN_REDIRECT",
        "SERVER_FAILED",
        "NETWORK_FAILED"
      ];
      if (item.error && item.error.current && errorList.includes(item.error.current) && downDataImageSave) {
        const data = {
          requestHeaders: { referer: downDataImageSave.pageUrl ?? "" },
          requestId: s.tabId,
          url: downDataImageSave.srcUrl ?? ""
        };
        chrome.tabs.create({
          url: `downloader.html?JSON=${encodeURIComponent(JSON.stringify(data))}&autoClose=true`,
          active: false
        });
        downDataImageSave = void 0;
      }
    });
    function contextMenusInit() {
      if (!chrome.contextMenus) return;
      chrome.contextMenus.removeAll(() => {
        if (chrome.runtime.lastError) return;
        chrome.contextMenus.create({
          id: "cat-catch",
          title: i18n("catCatch"),
          contexts: ["page", "image"]
        });
        chrome.contextMenus.create({
          id: "image-save",
          parentId: "cat-catch",
          title: i18n("save"),
          contexts: ["image"]
        });
        chrome.contextMenus.create({
          id: "enable",
          parentId: "cat-catch",
          title: `${i18n("enable")} / ${i18n("disable")}`,
          contexts: ["page", "image"]
        });
        chrome.contextMenus.create({
          id: "preview",
          parentId: "cat-catch",
          title: i18n("preview"),
          contexts: ["page", "image"]
        });
        chrome.contextMenus.create({
          id: "deepSearch",
          parentId: "cat-catch",
          title: i18n("deepSearch"),
          contexts: ["page", "image"]
        });
        chrome.contextMenus.create({
          id: "catch",
          parentId: "cat-catch",
          title: i18n("cacheCapture"),
          contexts: ["page", "image"]
        });
        chrome.contextMenus.create({
          id: "auto_down",
          parentId: "cat-catch",
          title: i18n("autoDownload"),
          contexts: ["page", "image"]
        });
      });
    }
    async function aria2AddUri(data) {
      var _a3, _b3;
      const opts = useSettingsStore.getState().options;
      const json = {
        jsonrpc: "2.0",
        id: "cat-catch-" + ((data == null ? void 0 : data.requestId) || Date.now()),
        method: "aria2.addUri",
        params: []
      };
      const params = json.params;
      if (opts.aria2RpcToken) {
        params.push(`token:${opts.aria2RpcToken}`);
      }
      const options = {};
      if (data == null ? void 0 : data.downFileName) {
        options.out = data.downFileName;
      }
      if (opts.aria2RpcDir) {
        options.dir = opts.aria2RpcDir;
      }
      if (opts.enableAria2RpcReferer) {
        const headers = [];
        headers.push("User-Agent: " + (opts.userAgent || navigator.userAgent));
        if ((_a3 = data == null ? void 0 : data.requestHeaders) == null ? void 0 : _a3.referer) {
          headers.push("Referer: " + data.requestHeaders.referer);
        }
        if (data == null ? void 0 : data.cookie) {
          headers.push("Cookie: " + data.cookie);
        }
        if ((_b3 = data == null ? void 0 : data.requestHeaders) == null ? void 0 : _b3.authorization) {
          headers.push("Authorization: " + data.requestHeaders.authorization);
        }
        options.header = headers;
      }
      params.push([data == null ? void 0 : data.url], options);
      const res = await fetch(opts.aria2Rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(json)
      });
      return await res.json();
    }
    function runCommands(command, data) {
      const s = useSettingsStore.getState();
      const tabId = s.tabId;
      switch (command) {
        case "auto_down": {
          if (s.featAutoDownTabId.has(tabId)) {
            s.removeFeatAutoDownTab(tabId);
          } else {
            s.addFeatAutoDownTab(tabId);
          }
          break;
        }
        case "catch": {
          s.toggleScriptTab("catch.js", tabId);
          chrome.tabs.reload(tabId, { bypassCache: true });
          break;
        }
        case "m3u8":
          void chrome.tabs.create({ url: "m3u8.html" });
          break;
        case "clear": {
          useMediaStore.getState().clearTab(tabId);
          void useMediaStore.getState().persist();
          clearRedundant();
          SetIcon({ tabId });
          break;
        }
        case "enable":
          void s.setEnable(!s.enable);
          break;
        case "reboot":
          chrome.runtime.reload();
          break;
        case "deepSearch": {
          const entry = s.scriptList.get("search.js");
          if (entry == null ? void 0 : entry.tabId.has(tabId)) {
            s.toggleScriptTab("search.js", tabId);
            s.setDeepSearchClose(tabId);
            chrome.tabs.reload(tabId, { bypassCache: true });
          } else {
            s.toggleScriptTab("search.js", tabId);
            chrome.tabs.reload(tabId, { bypassCache: true });
          }
          break;
        }
        case "preview":
          void chrome.tabs.create({ url: `preview.html?tabId=${tabId}` });
          break;
        case "image-save":
          if (data == null ? void 0 : data.srcUrl) {
            chrome.downloads.download(
              { url: data.srcUrl, saveAs: s.options.saveAs },
              () => {
                if (chrome.runtime.lastError) {
                  console.error(chrome.runtime.lastError);
                  return;
                }
                downDataImageSave = data;
              }
            );
          }
          break;
      }
    }
    (_a2 = chrome.commands) == null ? void 0 : _a2.onCommand.addListener((command) => runCommands(command));
    (_b2 = chrome.contextMenus) == null ? void 0 : _b2.onClicked.addListener(
      (info, _tab) => runCommands(String(info.menuItemId), info)
    );
    let downDataImageSave;
    async function findMedia(data, isRegex = false, filter = false, timer = false) {
      const s = useSettingsStore.getState();
      const m = useMediaStore.getState();
      const r = useRuntimeStore.getState();
      if (!s.initSyncComplete || !s.initLocalComplete || s.tabId === -1 || !m.initialized) {
        if (timer) return;
        setTimeout(() => void findMedia(data, isRegex, filter, true), 500);
        return;
      }
      if (s.options.damn && data.tabId !== void 0 && s.damnUrlSet.has(data.tabId)) {
        return;
      }
      const blockUrlFlag = data.tabId && data.tabId > 0 && s.blockUrlSet.has(data.tabId);
      if (!s.enable || (s.blockUrlWhite ? !blockUrlFlag : blockUrlFlag) || data.method === "OPTIONS") {
        return;
      }
      data.getTime = Date.now();
      if (!isRegex && data.requestId && r.hasBlackList(data.requestId)) {
        r.deleteBlackList(data.requestId);
        return;
      }
      const initiator = data.initiator;
      if (initiator !== "null" && initiator !== void 0 && isSpecialPage(initiator)) return;
      if (s.isFirefox) {
        const originUrl = data.originUrl;
        if (originUrl && isSpecialPage(originUrl)) return;
      }
      if (!data.url || isSpecialPage(data.url)) return;
      const urlParsing = new URL(data.url);
      let [name, ext] = fileNameParse(urlParsing.pathname);
      if (isRegex && !filter) {
        for (const rule of s.Regex) {
          if (!rule.state) continue;
          rule.regex.lastIndex = 0;
          const result2 = rule.regex.exec(data.url);
          if (result2 === null) continue;
          if (rule.blackList) {
            useRuntimeStore.getState().addBlackList(data.requestId ?? String(Date.now()));
            return;
          }
          data.extraExt = rule.ext ? rule.ext : void 0;
          if (result2.length === 1) {
            void findMedia(data, true, true);
            return;
          }
          const shifted = result2.slice(1).map((str) => decodeURIComponent(str));
          const first = shifted[0];
          if (first && !first.startsWith("https://") && !first.startsWith("http://")) {
            shifted[0] = urlParsing.protocol + "//" + data.url;
          }
          data.url = shifted.join("");
          void findMedia(data, true, true);
          return;
        }
        return;
      }
      if (!isRegex) {
        data.header = getResponseHeadersValue(data);
        const header = data.header;
        if (!filter && ext !== void 0) {
          filter = CheckExtension(ext, header.size);
          if (filter === "break") return;
        }
        if (!filter && header.type !== void 0) {
          filter = CheckType(header.type, header.size);
          if (filter === "break") return;
        }
        if (!filter && header.attachment !== void 0) {
          const parsed = parseAttachmentFilename(header.attachment);
          if (parsed) {
            [name, ext] = parsed;
            filter = CheckExtension(ext ?? "", 0);
            if (filter === "break") return;
          }
        }
        if (data.type === "media") {
          filter = true;
        }
      }
      if (!filter) return;
      if (data.tabId === -1 || data.tabId === void 0) {
        data.tabId = s.tabId;
      }
      const finalTabId = data.tabId;
      const currentList = useMediaStore.getState().getByTab(finalTabId);
      if (currentList.length > s.options.maxLength) {
        useMediaStore.getState().clearTab(finalTabId);
        void useMediaStore.getState().persist();
        return;
      }
      if (s.options.checkDuplicates && currentList.length <= 500) {
        if (useRuntimeStore.getState().hasUrl(finalTabId, data.url)) {
          return;
        }
        useRuntimeStore.getState().addUrl(finalTabId, data.url);
      }
      chrome.tabs.get(finalTabId, (webInfo) => {
        var _a3, _b3;
        if (chrome.runtime.lastError) return;
        const requestHeaders = getRequestHeaders(data) || void 0;
        let cookie;
        if (requestHeaders == null ? void 0 : requestHeaders.cookie) {
          cookie = requestHeaders.cookie;
          delete requestHeaders.cookie;
        }
        data.requestHeaders = requestHeaders;
        const info = {
          name,
          url: data.url,
          size: (_a3 = data.header) == null ? void 0 : _a3.size,
          ext,
          type: data.mime ?? ((_b3 = data.header) == null ? void 0 : _b3.type),
          tabId: finalTabId,
          isRegex,
          requestId: data.requestId ?? Date.now().toString(),
          initiator: data.initiator,
          requestHeaders,
          cookie,
          getTime: data.getTime
        };
        if (info.ext === void 0 && info.type !== void 0) {
          info.ext = info.type.split("/")[1];
        }
        if (data.extraExt) {
          info.ext = data.extraExt;
        }
        if (info.initiator === void 0 || info.initiator === "null") {
          info.initiator = (requestHeaders == null ? void 0 : requestHeaders.referer) ?? (webInfo == null ? void 0 : webInfo.url);
        }
        info.title = (webInfo == null ? void 0 : webInfo.title) ?? "NULL";
        info.favIconUrl = webInfo == null ? void 0 : webInfo.favIconUrl;
        info.webUrl = webInfo == null ? void 0 : webInfo.url;
        if (!isRegex && data.requestId && useRuntimeStore.getState().hasBlackList(data.requestId)) {
          useRuntimeStore.getState().deleteBlackList(data.requestId);
          return;
        }
        chrome.runtime.sendMessage({ Message: "popupAddData", data: info }, () => {
          var _a4;
          if (chrome.runtime.lastError) return;
          const st = useSettingsStore.getState();
          const downloadsState = (_a4 = chrome.downloads) == null ? void 0 : _a4.State;
          if (st.featAutoDownTabId.size > 0 && st.featAutoDownTabId.has(info.tabId) && downloadsState) {
            try {
              const title = !info.title || info.title === "NULL" ? "CatCatch/" : stringModify(info.title) + "/";
              let fileName;
              if (st.options.TitleName) {
                fileName = filterFileName(
                  templates(st.options.downFileName, info)
                );
              } else {
                const baseName = !info.name ? stringModify(info.title ?? "NULL") + "." + (info.ext ?? "") : decodeURIComponent(stringModify(info.name));
                fileName = title + baseName;
              }
              void chrome.downloads.download({ url: info.url, filename: fileName });
            } catch {
            }
          }
        });
        if (s.options.send2local) {
          try {
            void send2local("catch", { ...info, requestHeaders: data.allRequestHeaders }, info.tabId);
          } catch (e) {
            console.error(e);
          }
        }
        useMediaStore.getState().push(info);
        void save(finalTabId);
      });
    }
    async function save(tabId) {
      const r = useRuntimeStore.getState();
      if (r.debounceTimer) clearTimeout(r.debounceTimer);
      const list = useMediaStore.getState().getByTab(tabId);
      if (list.length <= 99) {
        void useMediaStore.getState().persist();
      }
      SetIcon({ number: list.length, tabId });
      useRuntimeStore.getState().setDebounce(void 0, 0, Date.now());
    }
  });
  function initPlugins() {
  }
  const browser$1 = ((_d = (_c = globalThis.browser) == null ? void 0 : _c.runtime) == null ? void 0 : _d.id) ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  var MatchPattern = (_e = class {
    /**
    * Parse a match pattern string. If it is invalid, the constructor will throw an
    * `InvalidMatchPattern` error.
    *
    * @param matchPattern The match pattern to parse.
    */
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._e.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null) throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    /** Check if a URL is included in a pattern. */
    includes(url) {
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      if (this.isAllUrls) return !this.isUnknownProtocol(u);
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http") return this.isHttpMatch(u);
        if (protocol === "https") return this.isHttpsMatch(u);
        if (protocol === "file") return this.isFileMatch(u);
        if (protocol === "ftp") return this.isFtpMatch(u);
        if (protocol === "urn") return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch) return false;
      const hostnameMatchRegexs = [this.convertPatternToRegex(this.hostnameMatch), this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isUnknownProtocol(url) {
      return !this.protocolMatches.includes(url.protocol.slice(0, -1));
    }
    isPathMatch(url) {
      if (!this.pathnameMatch) return false;
      return this.convertPatternToRegex(this.pathnameMatch).test(url.pathname);
    }
    isFileMatch(url) {
      return url.protocol === "file:" && this.isPathMatch(url);
    }
    isFtpMatch(_url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(_url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const starsReplaced = this.escapeForRegex(pattern).replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }, _e.PROTOCOLS = [
    "http",
    "https",
    "file",
    "ftp",
    "urn",
    "ws",
    "wss"
  ], _e);
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*") throw new InvalidMatchPattern(matchPattern, `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`);
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":")) throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*.")) throw new InvalidMatchPattern(matchPattern, `If using a wildcard (*), it must go at the start of the hostname`);
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") method(`[wxt] ${args.shift()}`, ...args);
    else method("[wxt]", ...args);
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = "ws://localhost:3000";
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws == null ? void 0 : ws.send(JSON.stringify({
        type: "custom",
        event,
        payload
      }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") ws == null ? void 0 : ws.dispatchEvent(new CustomEvent(message.event, { detail: message.data }));
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    if (browser.runtime.getManifest().manifest_version == 2) reloadContentScriptMv2();
    else reloadContentScriptMv3(payload);
  }
  async function reloadContentScriptMv3({ registration, contentScript }) {
    if (registration === "runtime") await reloadRuntimeContentScriptMv3(contentScript);
    else await reloadManifestContentScriptMv3(contentScript);
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([{
        ...contentScript,
        id,
        css: contentScript.css ?? []
      }]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([{
        ...contentScript,
        id,
        css: contentScript.css ?? []
      }]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      var _a2, _b2;
      const hasJs = (_a2 = contentScript.js) == null ? void 0 : _a2.find((js) => {
        var _a3;
        return (_a3 = cs.js) == null ? void 0 : _a3.includes(js);
      });
      const hasCss = (_b2 = contentScript.css) == null ? void 0 : _b2.find((css) => {
        var _a3;
        return (_a3 = cs.css) == null ? void 0 : _a3.includes(css);
      });
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log("Content script is not registered yet, nothing to reload", contentScript);
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map((match) => new MatchPattern(match));
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(matchingTabs.map(async (tab) => {
      try {
        await browser.tabs.reload(tab.id);
      } catch (err) {
        logger.warn("Failed to reload tab:", err);
      }
    }));
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener("open", () => ws2.sendCustom("wxt:background-initialized"));
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") browser.runtime.reload();
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) console.warn("The background's main() function return a promise, but it must be synchronous");
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  var background_entrypoint_default = result;
  return background_entrypoint_default;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIxLjRfdHlwZXNjcmlwdEA1LjkuM192aXRlQDYuNC4zL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9kZWZpbmUtYmFja2dyb3VuZC5tanMiLCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0venVzdGFuZEA1LjAuMTVfQHR5cGVzK3JlYWN0QDE5LjIuMThfcmVhY3RAMTkuMi44L25vZGVfbW9kdWxlcy96dXN0YW5kL2VzbS92YW5pbGxhLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9yZWFjdEAxOS4yLjgvbm9kZV9tb2R1bGVzL3JlYWN0L2Nqcy9yZWFjdC5kZXZlbG9wbWVudC5qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9yZWFjdEAxOS4yLjgvbm9kZV9tb2R1bGVzL3JlYWN0L2luZGV4LmpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3p1c3RhbmRANS4wLjE1X0B0eXBlcytyZWFjdEAxOS4yLjE4X3JlYWN0QDE5LjIuOC9ub2RlX21vZHVsZXMvenVzdGFuZC9lc20vcmVhY3QubWpzIiwiLi4vLi4vc3JjL2xpYi9jb25maWcudHMiLCIuLi8uLi9zcmMvc3RvcmVzL3NldHRpbmdzLnRzIiwiLi4vLi4vc3JjL3N0b3Jlcy9tZWRpYS50cyIsIi4uLy4uL3NyYy9zdG9yZXMvcnVudGltZS50cyIsIi4uLy4uL3NyYy9saWIvZmluZC1tZWRpYS50cyIsIi4uLy4uL3NyYy9saWIvdGVtcGxhdGUudHMiLCIuLi8uLi9zcmMvbGliL2Z1bmN0aW9uLnRzIiwiLi4vLi4vc3JjL2xpYi9pMThuLnRzIiwiLi4vLi4vc3JjL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiLCIuLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjIuNy9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIxLjRfdHlwZXNjcmlwdEA1LjkuM192aXRlQDYuNC4zL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad2ViZXh0LWNvcmUrbWF0Y2gtcGF0dGVybnNAMi4wLjAvbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9kaXN0L2luZGV4Lm1qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyNyZWdpb24gc3JjL3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLnRzXG5mdW5jdGlvbiBkZWZpbmVCYWNrZ3JvdW5kKGFyZykge1xuXHRpZiAoYXJnID09IG51bGwgfHwgdHlwZW9mIGFyZyA9PT0gXCJmdW5jdGlvblwiKSByZXR1cm4geyBtYWluOiBhcmcgfTtcblx0cmV0dXJuIGFyZztcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgZGVmaW5lQmFja2dyb3VuZCB9O1xuIiwiY29uc3QgY3JlYXRlU3RvcmVJbXBsID0gKGNyZWF0ZVN0YXRlKSA9PiB7XG4gIGxldCBzdGF0ZTtcbiAgY29uc3QgbGlzdGVuZXJzID0gLyogQF9fUFVSRV9fICovIG5ldyBTZXQoKTtcbiAgY29uc3Qgc2V0U3RhdGUgPSAocGFydGlhbCwgcmVwbGFjZSkgPT4ge1xuICAgIGNvbnN0IG5leHRTdGF0ZSA9IHR5cGVvZiBwYXJ0aWFsID09PSBcImZ1bmN0aW9uXCIgPyBwYXJ0aWFsKHN0YXRlKSA6IHBhcnRpYWw7XG4gICAgaWYgKCFPYmplY3QuaXMobmV4dFN0YXRlLCBzdGF0ZSkpIHtcbiAgICAgIGNvbnN0IHByZXZpb3VzU3RhdGUgPSBzdGF0ZTtcbiAgICAgIHN0YXRlID0gKHJlcGxhY2UgIT0gbnVsbCA/IHJlcGxhY2UgOiB0eXBlb2YgbmV4dFN0YXRlICE9PSBcIm9iamVjdFwiIHx8IG5leHRTdGF0ZSA9PT0gbnVsbCkgPyBuZXh0U3RhdGUgOiBPYmplY3QuYXNzaWduKHt9LCBzdGF0ZSwgbmV4dFN0YXRlKTtcbiAgICAgIGxpc3RlbmVycy5mb3JFYWNoKChsaXN0ZW5lcikgPT4gbGlzdGVuZXIoc3RhdGUsIHByZXZpb3VzU3RhdGUpKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGdldFN0YXRlID0gKCkgPT4gc3RhdGU7XG4gIGNvbnN0IGdldEluaXRpYWxTdGF0ZSA9ICgpID0+IGluaXRpYWxTdGF0ZTtcbiAgY29uc3Qgc3Vic2NyaWJlID0gKGxpc3RlbmVyKSA9PiB7XG4gICAgbGlzdGVuZXJzLmFkZChsaXN0ZW5lcik7XG4gICAgcmV0dXJuICgpID0+IGxpc3RlbmVycy5kZWxldGUobGlzdGVuZXIpO1xuICB9O1xuICBjb25zdCBhcGkgPSB7IHNldFN0YXRlLCBnZXRTdGF0ZSwgZ2V0SW5pdGlhbFN0YXRlLCBzdWJzY3JpYmUgfTtcbiAgY29uc3QgaW5pdGlhbFN0YXRlID0gc3RhdGUgPSBjcmVhdGVTdGF0ZShzZXRTdGF0ZSwgZ2V0U3RhdGUsIGFwaSk7XG4gIHJldHVybiBhcGk7XG59O1xuY29uc3QgY3JlYXRlU3RvcmUgPSAoKGNyZWF0ZVN0YXRlKSA9PiBjcmVhdGVTdGF0ZSA/IGNyZWF0ZVN0b3JlSW1wbChjcmVhdGVTdGF0ZSkgOiBjcmVhdGVTdG9yZUltcGwpO1xuXG5leHBvcnQgeyBjcmVhdGVTdG9yZSB9O1xuIiwiLyoqXG4gKiBAbGljZW5zZSBSZWFjdFxuICogcmVhY3QuZGV2ZWxvcG1lbnQuanNcbiAqXG4gKiBDb3B5cmlnaHQgKGMpIE1ldGEgUGxhdGZvcm1zLCBJbmMuIGFuZCBhZmZpbGlhdGVzLlxuICpcbiAqIFRoaXMgc291cmNlIGNvZGUgaXMgbGljZW5zZWQgdW5kZXIgdGhlIE1JVCBsaWNlbnNlIGZvdW5kIGluIHRoZVxuICogTElDRU5TRSBmaWxlIGluIHRoZSByb290IGRpcmVjdG9yeSBvZiB0aGlzIHNvdXJjZSB0cmVlLlxuICovXG5cblwidXNlIHN0cmljdFwiO1xuXCJwcm9kdWN0aW9uXCIgIT09IHByb2Nlc3MuZW52Lk5PREVfRU5WICYmXG4gIChmdW5jdGlvbiAoKSB7XG4gICAgZnVuY3Rpb24gZGVmaW5lRGVwcmVjYXRpb25XYXJuaW5nKG1ldGhvZE5hbWUsIGluZm8pIHtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShDb21wb25lbnQucHJvdG90eXBlLCBtZXRob2ROYW1lLCB7XG4gICAgICAgIGdldDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICAgIFwiJXMoLi4uKSBpcyBkZXByZWNhdGVkIGluIHBsYWluIEphdmFTY3JpcHQgUmVhY3QgY2xhc3Nlcy4gJXNcIixcbiAgICAgICAgICAgIGluZm9bMF0sXG4gICAgICAgICAgICBpbmZvWzFdXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGdldEl0ZXJhdG9yRm4obWF5YmVJdGVyYWJsZSkge1xuICAgICAgaWYgKG51bGwgPT09IG1heWJlSXRlcmFibGUgfHwgXCJvYmplY3RcIiAhPT0gdHlwZW9mIG1heWJlSXRlcmFibGUpXG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgbWF5YmVJdGVyYWJsZSA9XG4gICAgICAgIChNQVlCRV9JVEVSQVRPUl9TWU1CT0wgJiYgbWF5YmVJdGVyYWJsZVtNQVlCRV9JVEVSQVRPUl9TWU1CT0xdKSB8fFxuICAgICAgICBtYXliZUl0ZXJhYmxlW1wiQEBpdGVyYXRvclwiXTtcbiAgICAgIHJldHVybiBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBtYXliZUl0ZXJhYmxlID8gbWF5YmVJdGVyYWJsZSA6IG51bGw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCBjYWxsZXJOYW1lKSB7XG4gICAgICBwdWJsaWNJbnN0YW5jZSA9XG4gICAgICAgICgocHVibGljSW5zdGFuY2UgPSBwdWJsaWNJbnN0YW5jZS5jb25zdHJ1Y3RvcikgJiZcbiAgICAgICAgICAocHVibGljSW5zdGFuY2UuZGlzcGxheU5hbWUgfHwgcHVibGljSW5zdGFuY2UubmFtZSkpIHx8XG4gICAgICAgIFwiUmVhY3RDbGFzc1wiO1xuICAgICAgdmFyIHdhcm5pbmdLZXkgPSBwdWJsaWNJbnN0YW5jZSArIFwiLlwiICsgY2FsbGVyTmFtZTtcbiAgICAgIGRpZFdhcm5TdGF0ZVVwZGF0ZUZvclVubW91bnRlZENvbXBvbmVudFt3YXJuaW5nS2V5XSB8fFxuICAgICAgICAoY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkNhbid0IGNhbGwgJXMgb24gYSBjb21wb25lbnQgdGhhdCBpcyBub3QgeWV0IG1vdW50ZWQuIFRoaXMgaXMgYSBuby1vcCwgYnV0IGl0IG1pZ2h0IGluZGljYXRlIGEgYnVnIGluIHlvdXIgYXBwbGljYXRpb24uIEluc3RlYWQsIGFzc2lnbiB0byBgdGhpcy5zdGF0ZWAgZGlyZWN0bHkgb3IgZGVmaW5lIGEgYHN0YXRlID0ge307YCBjbGFzcyBwcm9wZXJ0eSB3aXRoIHRoZSBkZXNpcmVkIHN0YXRlIGluIHRoZSAlcyBjb21wb25lbnQuXCIsXG4gICAgICAgICAgY2FsbGVyTmFtZSxcbiAgICAgICAgICBwdWJsaWNJbnN0YW5jZVxuICAgICAgICApLFxuICAgICAgICAoZGlkV2FyblN0YXRlVXBkYXRlRm9yVW5tb3VudGVkQ29tcG9uZW50W3dhcm5pbmdLZXldID0gITApKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gQ29tcG9uZW50KHByb3BzLCBjb250ZXh0LCB1cGRhdGVyKSB7XG4gICAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgICB0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuICAgICAgdGhpcy5yZWZzID0gZW1wdHlPYmplY3Q7XG4gICAgICB0aGlzLnVwZGF0ZXIgPSB1cGRhdGVyIHx8IFJlYWN0Tm9vcFVwZGF0ZVF1ZXVlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBDb21wb25lbnREdW1teSgpIHt9XG4gICAgZnVuY3Rpb24gUHVyZUNvbXBvbmVudChwcm9wcywgY29udGV4dCwgdXBkYXRlcikge1xuICAgICAgdGhpcy5wcm9wcyA9IHByb3BzO1xuICAgICAgdGhpcy5jb250ZXh0ID0gY29udGV4dDtcbiAgICAgIHRoaXMucmVmcyA9IGVtcHR5T2JqZWN0O1xuICAgICAgdGhpcy51cGRhdGVyID0gdXBkYXRlciB8fCBSZWFjdE5vb3BVcGRhdGVRdWV1ZTtcbiAgICB9XG4gICAgZnVuY3Rpb24gbm9vcCgpIHt9XG4gICAgZnVuY3Rpb24gdGVzdFN0cmluZ0NvZXJjaW9uKHZhbHVlKSB7XG4gICAgICByZXR1cm4gXCJcIiArIHZhbHVlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjaGVja0tleVN0cmluZ0NvZXJjaW9uKHZhbHVlKSB7XG4gICAgICB0cnkge1xuICAgICAgICB0ZXN0U3RyaW5nQ29lcmNpb24odmFsdWUpO1xuICAgICAgICB2YXIgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gITE7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9ICEwO1xuICAgICAgfVxuICAgICAgaWYgKEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCkge1xuICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQgPSBjb25zb2xlO1xuICAgICAgICB2YXIgSlNDb21waWxlcl90ZW1wX2NvbnN0ID0gSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0LmVycm9yO1xuICAgICAgICB2YXIgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0JGpzY29tcCQwID1cbiAgICAgICAgICAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgU3ltYm9sICYmXG4gICAgICAgICAgICBTeW1ib2wudG9TdHJpbmdUYWcgJiZcbiAgICAgICAgICAgIHZhbHVlW1N5bWJvbC50b1N0cmluZ1RhZ10pIHx8XG4gICAgICAgICAgdmFsdWUuY29uc3RydWN0b3IubmFtZSB8fFxuICAgICAgICAgIFwiT2JqZWN0XCI7XG4gICAgICAgIEpTQ29tcGlsZXJfdGVtcF9jb25zdC5jYWxsKFxuICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCxcbiAgICAgICAgICBcIlRoZSBwcm92aWRlZCBrZXkgaXMgYW4gdW5zdXBwb3J0ZWQgdHlwZSAlcy4gVGhpcyB2YWx1ZSBtdXN0IGJlIGNvZXJjZWQgdG8gYSBzdHJpbmcgYmVmb3JlIHVzaW5nIGl0IGhlcmUuXCIsXG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0JGpzY29tcCQwXG4gICAgICAgICk7XG4gICAgICAgIHJldHVybiB0ZXN0U3RyaW5nQ29lcmNpb24odmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZSkge1xuICAgICAgaWYgKG51bGwgPT0gdHlwZSkgcmV0dXJuIG51bGw7XG4gICAgICBpZiAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgcmV0dXJuIHR5cGUuJCR0eXBlb2YgPT09IFJFQUNUX0NMSUVOVF9SRUZFUkVOQ0VcbiAgICAgICAgICA/IG51bGxcbiAgICAgICAgICA6IHR5cGUuZGlzcGxheU5hbWUgfHwgdHlwZS5uYW1lIHx8IG51bGw7XG4gICAgICBpZiAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIHR5cGUpIHJldHVybiB0eXBlO1xuICAgICAgc3dpdGNoICh0eXBlKSB7XG4gICAgICAgIGNhc2UgUkVBQ1RfRlJBR01FTlRfVFlQRTpcbiAgICAgICAgICByZXR1cm4gXCJGcmFnbWVudFwiO1xuICAgICAgICBjYXNlIFJFQUNUX1BST0ZJTEVSX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiUHJvZmlsZXJcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN0cmljdE1vZGVcIjtcbiAgICAgICAgY2FzZSBSRUFDVF9TVVNQRU5TRV9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlXCI7XG4gICAgICAgIGNhc2UgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFOlxuICAgICAgICAgIHJldHVybiBcIlN1c3BlbnNlTGlzdFwiO1xuICAgICAgICBjYXNlIFJFQUNUX0FDVElWSVRZX1RZUEU6XG4gICAgICAgICAgcmV0dXJuIFwiQWN0aXZpdHlcIjtcbiAgICAgIH1cbiAgICAgIGlmIChcIm9iamVjdFwiID09PSB0eXBlb2YgdHlwZSlcbiAgICAgICAgc3dpdGNoIChcbiAgICAgICAgICAoXCJudW1iZXJcIiA9PT0gdHlwZW9mIHR5cGUudGFnICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIlJlY2VpdmVkIGFuIHVuZXhwZWN0ZWQgb2JqZWN0IGluIGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSgpLiBUaGlzIGlzIGxpa2VseSBhIGJ1ZyBpbiBSZWFjdC4gUGxlYXNlIGZpbGUgYW4gaXNzdWUuXCJcbiAgICAgICAgICAgICksXG4gICAgICAgICAgdHlwZS4kJHR5cGVvZilcbiAgICAgICAgKSB7XG4gICAgICAgICAgY2FzZSBSRUFDVF9QT1JUQUxfVFlQRTpcbiAgICAgICAgICAgIHJldHVybiBcIlBvcnRhbFwiO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfQ09OVEVYVF9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIHR5cGUuZGlzcGxheU5hbWUgfHwgXCJDb250ZXh0XCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9DT05TVU1FUl9UWVBFOlxuICAgICAgICAgICAgcmV0dXJuICh0eXBlLl9jb250ZXh0LmRpc3BsYXlOYW1lIHx8IFwiQ29udGV4dFwiKSArIFwiLkNvbnN1bWVyXCI7XG4gICAgICAgICAgY2FzZSBSRUFDVF9GT1JXQVJEX1JFRl9UWVBFOlxuICAgICAgICAgICAgdmFyIGlubmVyVHlwZSA9IHR5cGUucmVuZGVyO1xuICAgICAgICAgICAgdHlwZSA9IHR5cGUuZGlzcGxheU5hbWU7XG4gICAgICAgICAgICB0eXBlIHx8XG4gICAgICAgICAgICAgICgodHlwZSA9IGlubmVyVHlwZS5kaXNwbGF5TmFtZSB8fCBpbm5lclR5cGUubmFtZSB8fCBcIlwiKSxcbiAgICAgICAgICAgICAgKHR5cGUgPSBcIlwiICE9PSB0eXBlID8gXCJGb3J3YXJkUmVmKFwiICsgdHlwZSArIFwiKVwiIDogXCJGb3J3YXJkUmVmXCIpKTtcbiAgICAgICAgICAgIHJldHVybiB0eXBlO1xuICAgICAgICAgIGNhc2UgUkVBQ1RfTUVNT19UWVBFOlxuICAgICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgICAgKGlubmVyVHlwZSA9IHR5cGUuZGlzcGxheU5hbWUgfHwgbnVsbCksXG4gICAgICAgICAgICAgIG51bGwgIT09IGlubmVyVHlwZVxuICAgICAgICAgICAgICAgID8gaW5uZXJUeXBlXG4gICAgICAgICAgICAgICAgOiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZS50eXBlKSB8fCBcIk1lbW9cIlxuICAgICAgICAgICAgKTtcbiAgICAgICAgICBjYXNlIFJFQUNUX0xBWllfVFlQRTpcbiAgICAgICAgICAgIGlubmVyVHlwZSA9IHR5cGUuX3BheWxvYWQ7XG4gICAgICAgICAgICB0eXBlID0gdHlwZS5faW5pdDtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIHJldHVybiBnZXRDb21wb25lbnROYW1lRnJvbVR5cGUodHlwZShpbm5lclR5cGUpKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKHgpIHt9XG4gICAgICAgIH1cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRUYXNrTmFtZSh0eXBlKSB7XG4gICAgICBpZiAodHlwZSA9PT0gUkVBQ1RfRlJBR01FTlRfVFlQRSkgcmV0dXJuIFwiPD5cIjtcbiAgICAgIGlmIChcbiAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHR5cGUgJiZcbiAgICAgICAgbnVsbCAhPT0gdHlwZSAmJlxuICAgICAgICB0eXBlLiQkdHlwZW9mID09PSBSRUFDVF9MQVpZX1RZUEVcbiAgICAgIClcbiAgICAgICAgcmV0dXJuIFwiPC4uLj5cIjtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciBuYW1lID0gZ2V0Q29tcG9uZW50TmFtZUZyb21UeXBlKHR5cGUpO1xuICAgICAgICByZXR1cm4gbmFtZSA/IFwiPFwiICsgbmFtZSArIFwiPlwiIDogXCI8Li4uPlwiO1xuICAgICAgfSBjYXRjaCAoeCkge1xuICAgICAgICByZXR1cm4gXCI8Li4uPlwiO1xuICAgICAgfVxuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRPd25lcigpIHtcbiAgICAgIHZhciBkaXNwYXRjaGVyID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuQTtcbiAgICAgIHJldHVybiBudWxsID09PSBkaXNwYXRjaGVyID8gbnVsbCA6IGRpc3BhdGNoZXIuZ2V0T3duZXIoKTtcbiAgICB9XG4gICAgZnVuY3Rpb24gVW5rbm93bk93bmVyKCkge1xuICAgICAgcmV0dXJuIEVycm9yKFwicmVhY3Qtc3RhY2stdG9wLWZyYW1lXCIpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBoYXNWYWxpZEtleShjb25maWcpIHtcbiAgICAgIGlmIChoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgXCJrZXlcIikpIHtcbiAgICAgICAgdmFyIGdldHRlciA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoY29uZmlnLCBcImtleVwiKS5nZXQ7XG4gICAgICAgIGlmIChnZXR0ZXIgJiYgZ2V0dGVyLmlzUmVhY3RXYXJuaW5nKSByZXR1cm4gITE7XG4gICAgICB9XG4gICAgICByZXR1cm4gdm9pZCAwICE9PSBjb25maWcua2V5O1xuICAgIH1cbiAgICBmdW5jdGlvbiBkZWZpbmVLZXlQcm9wV2FybmluZ0dldHRlcihwcm9wcywgZGlzcGxheU5hbWUpIHtcbiAgICAgIGZ1bmN0aW9uIHdhcm5BYm91dEFjY2Vzc2luZ0tleSgpIHtcbiAgICAgICAgc3BlY2lhbFByb3BLZXlXYXJuaW5nU2hvd24gfHxcbiAgICAgICAgICAoKHNwZWNpYWxQcm9wS2V5V2FybmluZ1Nob3duID0gITApLFxuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICBcIiVzOiBga2V5YCBpcyBub3QgYSBwcm9wLiBUcnlpbmcgdG8gYWNjZXNzIGl0IHdpbGwgcmVzdWx0IGluIGB1bmRlZmluZWRgIGJlaW5nIHJldHVybmVkLiBJZiB5b3UgbmVlZCB0byBhY2Nlc3MgdGhlIHNhbWUgdmFsdWUgd2l0aGluIHRoZSBjaGlsZCBjb21wb25lbnQsIHlvdSBzaG91bGQgcGFzcyBpdCBhcyBhIGRpZmZlcmVudCBwcm9wLiAoaHR0cHM6Ly9yZWFjdC5kZXYvbGluay9zcGVjaWFsLXByb3BzKVwiLFxuICAgICAgICAgICAgZGlzcGxheU5hbWVcbiAgICAgICAgICApKTtcbiAgICAgIH1cbiAgICAgIHdhcm5BYm91dEFjY2Vzc2luZ0tleS5pc1JlYWN0V2FybmluZyA9ICEwO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHByb3BzLCBcImtleVwiLCB7XG4gICAgICAgIGdldDogd2FybkFib3V0QWNjZXNzaW5nS2V5LFxuICAgICAgICBjb25maWd1cmFibGU6ICEwXG4gICAgICB9KTtcbiAgICB9XG4gICAgZnVuY3Rpb24gZWxlbWVudFJlZkdldHRlcldpdGhEZXByZWNhdGlvbldhcm5pbmcoKSB7XG4gICAgICB2YXIgY29tcG9uZW50TmFtZSA9IGdldENvbXBvbmVudE5hbWVGcm9tVHlwZSh0aGlzLnR5cGUpO1xuICAgICAgZGlkV2FybkFib3V0RWxlbWVudFJlZltjb21wb25lbnROYW1lXSB8fFxuICAgICAgICAoKGRpZFdhcm5BYm91dEVsZW1lbnRSZWZbY29tcG9uZW50TmFtZV0gPSAhMCksXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJBY2Nlc3NpbmcgZWxlbWVudC5yZWYgd2FzIHJlbW92ZWQgaW4gUmVhY3QgMTkuIHJlZiBpcyBub3cgYSByZWd1bGFyIHByb3AuIEl0IHdpbGwgYmUgcmVtb3ZlZCBmcm9tIHRoZSBKU1ggRWxlbWVudCB0eXBlIGluIGEgZnV0dXJlIHJlbGVhc2UuXCJcbiAgICAgICAgKSk7XG4gICAgICBjb21wb25lbnROYW1lID0gdGhpcy5wcm9wcy5yZWY7XG4gICAgICByZXR1cm4gdm9pZCAwICE9PSBjb21wb25lbnROYW1lID8gY29tcG9uZW50TmFtZSA6IG51bGw7XG4gICAgfVxuICAgIGZ1bmN0aW9uIFJlYWN0RWxlbWVudCh0eXBlLCBrZXksIHByb3BzLCBvd25lciwgZGVidWdTdGFjaywgZGVidWdUYXNrKSB7XG4gICAgICB2YXIgcmVmUHJvcCA9IHByb3BzLnJlZjtcbiAgICAgIHR5cGUgPSB7XG4gICAgICAgICQkdHlwZW9mOiBSRUFDVF9FTEVNRU5UX1RZUEUsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGtleToga2V5LFxuICAgICAgICBwcm9wczogcHJvcHMsXG4gICAgICAgIF9vd25lcjogb3duZXJcbiAgICAgIH07XG4gICAgICBudWxsICE9PSAodm9pZCAwICE9PSByZWZQcm9wID8gcmVmUHJvcCA6IG51bGwpXG4gICAgICAgID8gT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwicmVmXCIsIHtcbiAgICAgICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICAgICAgZ2V0OiBlbGVtZW50UmVmR2V0dGVyV2l0aERlcHJlY2F0aW9uV2FybmluZ1xuICAgICAgICAgIH0pXG4gICAgICAgIDogT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwicmVmXCIsIHsgZW51bWVyYWJsZTogITEsIHZhbHVlOiBudWxsIH0pO1xuICAgICAgdHlwZS5fc3RvcmUgPSB7fTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLl9zdG9yZSwgXCJ2YWxpZGF0ZWRcIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogMFxuICAgICAgfSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJfZGVidWdJbmZvXCIsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiAhMSxcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIHdyaXRhYmxlOiAhMCxcbiAgICAgICAgdmFsdWU6IG51bGxcbiAgICAgIH0pO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHR5cGUsIFwiX2RlYnVnU3RhY2tcIiwge1xuICAgICAgICBjb25maWd1cmFibGU6ICExLFxuICAgICAgICBlbnVtZXJhYmxlOiAhMSxcbiAgICAgICAgd3JpdGFibGU6ICEwLFxuICAgICAgICB2YWx1ZTogZGVidWdTdGFja1xuICAgICAgfSk7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodHlwZSwgXCJfZGVidWdUYXNrXCIsIHtcbiAgICAgICAgY29uZmlndXJhYmxlOiAhMSxcbiAgICAgICAgZW51bWVyYWJsZTogITEsXG4gICAgICAgIHdyaXRhYmxlOiAhMCxcbiAgICAgICAgdmFsdWU6IGRlYnVnVGFza1xuICAgICAgfSk7XG4gICAgICBPYmplY3QuZnJlZXplICYmIChPYmplY3QuZnJlZXplKHR5cGUucHJvcHMpLCBPYmplY3QuZnJlZXplKHR5cGUpKTtcbiAgICAgIHJldHVybiB0eXBlO1xuICAgIH1cbiAgICBmdW5jdGlvbiBjbG9uZUFuZFJlcGxhY2VLZXkob2xkRWxlbWVudCwgbmV3S2V5KSB7XG4gICAgICBuZXdLZXkgPSBSZWFjdEVsZW1lbnQoXG4gICAgICAgIG9sZEVsZW1lbnQudHlwZSxcbiAgICAgICAgbmV3S2V5LFxuICAgICAgICBvbGRFbGVtZW50LnByb3BzLFxuICAgICAgICBvbGRFbGVtZW50Ll9vd25lcixcbiAgICAgICAgb2xkRWxlbWVudC5fZGVidWdTdGFjayxcbiAgICAgICAgb2xkRWxlbWVudC5fZGVidWdUYXNrXG4gICAgICApO1xuICAgICAgb2xkRWxlbWVudC5fc3RvcmUgJiZcbiAgICAgICAgKG5ld0tleS5fc3RvcmUudmFsaWRhdGVkID0gb2xkRWxlbWVudC5fc3RvcmUudmFsaWRhdGVkKTtcbiAgICAgIHJldHVybiBuZXdLZXk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHZhbGlkYXRlQ2hpbGRLZXlzKG5vZGUpIHtcbiAgICAgIGlzVmFsaWRFbGVtZW50KG5vZGUpXG4gICAgICAgID8gbm9kZS5fc3RvcmUgJiYgKG5vZGUuX3N0b3JlLnZhbGlkYXRlZCA9IDEpXG4gICAgICAgIDogXCJvYmplY3RcIiA9PT0gdHlwZW9mIG5vZGUgJiZcbiAgICAgICAgICBudWxsICE9PSBub2RlICYmXG4gICAgICAgICAgbm9kZS4kJHR5cGVvZiA9PT0gUkVBQ1RfTEFaWV9UWVBFICYmXG4gICAgICAgICAgKFwiZnVsZmlsbGVkXCIgPT09IG5vZGUuX3BheWxvYWQuc3RhdHVzXG4gICAgICAgICAgICA/IGlzVmFsaWRFbGVtZW50KG5vZGUuX3BheWxvYWQudmFsdWUpICYmXG4gICAgICAgICAgICAgIG5vZGUuX3BheWxvYWQudmFsdWUuX3N0b3JlICYmXG4gICAgICAgICAgICAgIChub2RlLl9wYXlsb2FkLnZhbHVlLl9zdG9yZS52YWxpZGF0ZWQgPSAxKVxuICAgICAgICAgICAgOiBub2RlLl9zdG9yZSAmJiAobm9kZS5fc3RvcmUudmFsaWRhdGVkID0gMSkpO1xuICAgIH1cbiAgICBmdW5jdGlvbiBpc1ZhbGlkRWxlbWVudChvYmplY3QpIHtcbiAgICAgIHJldHVybiAoXG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiBvYmplY3QgJiZcbiAgICAgICAgbnVsbCAhPT0gb2JqZWN0ICYmXG4gICAgICAgIG9iamVjdC4kJHR5cGVvZiA9PT0gUkVBQ1RfRUxFTUVOVF9UWVBFXG4gICAgICApO1xuICAgIH1cbiAgICBmdW5jdGlvbiBlc2NhcGUoa2V5KSB7XG4gICAgICB2YXIgZXNjYXBlckxvb2t1cCA9IHsgXCI9XCI6IFwiPTBcIiwgXCI6XCI6IFwiPTJcIiB9O1xuICAgICAgcmV0dXJuIChcbiAgICAgICAgXCIkXCIgK1xuICAgICAgICBrZXkucmVwbGFjZSgvWz06XS9nLCBmdW5jdGlvbiAobWF0Y2gpIHtcbiAgICAgICAgICByZXR1cm4gZXNjYXBlckxvb2t1cFttYXRjaF07XG4gICAgICAgIH0pXG4gICAgICApO1xuICAgIH1cbiAgICBmdW5jdGlvbiBnZXRFbGVtZW50S2V5KGVsZW1lbnQsIGluZGV4KSB7XG4gICAgICByZXR1cm4gXCJvYmplY3RcIiA9PT0gdHlwZW9mIGVsZW1lbnQgJiZcbiAgICAgICAgbnVsbCAhPT0gZWxlbWVudCAmJlxuICAgICAgICBudWxsICE9IGVsZW1lbnQua2V5XG4gICAgICAgID8gKGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oZWxlbWVudC5rZXkpLCBlc2NhcGUoXCJcIiArIGVsZW1lbnQua2V5KSlcbiAgICAgICAgOiBpbmRleC50b1N0cmluZygzNik7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlc29sdmVUaGVuYWJsZSh0aGVuYWJsZSkge1xuICAgICAgc3dpdGNoICh0aGVuYWJsZS5zdGF0dXMpIHtcbiAgICAgICAgY2FzZSBcImZ1bGZpbGxlZFwiOlxuICAgICAgICAgIHJldHVybiB0aGVuYWJsZS52YWx1ZTtcbiAgICAgICAgY2FzZSBcInJlamVjdGVkXCI6XG4gICAgICAgICAgdGhyb3cgdGhlbmFibGUucmVhc29uO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHN3aXRjaCAoXG4gICAgICAgICAgICAoXCJzdHJpbmdcIiA9PT0gdHlwZW9mIHRoZW5hYmxlLnN0YXR1c1xuICAgICAgICAgICAgICA/IHRoZW5hYmxlLnRoZW4obm9vcCwgbm9vcClcbiAgICAgICAgICAgICAgOiAoKHRoZW5hYmxlLnN0YXR1cyA9IFwicGVuZGluZ1wiKSxcbiAgICAgICAgICAgICAgICB0aGVuYWJsZS50aGVuKFxuICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGZ1bGZpbGxlZFZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgIFwicGVuZGluZ1wiID09PSB0aGVuYWJsZS5zdGF0dXMgJiZcbiAgICAgICAgICAgICAgICAgICAgICAoKHRoZW5hYmxlLnN0YXR1cyA9IFwiZnVsZmlsbGVkXCIpLFxuICAgICAgICAgICAgICAgICAgICAgICh0aGVuYWJsZS52YWx1ZSA9IGZ1bGZpbGxlZFZhbHVlKSk7XG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgICAgIFwicGVuZGluZ1wiID09PSB0aGVuYWJsZS5zdGF0dXMgJiZcbiAgICAgICAgICAgICAgICAgICAgICAoKHRoZW5hYmxlLnN0YXR1cyA9IFwicmVqZWN0ZWRcIiksXG4gICAgICAgICAgICAgICAgICAgICAgKHRoZW5hYmxlLnJlYXNvbiA9IGVycm9yKSk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgKSksXG4gICAgICAgICAgICB0aGVuYWJsZS5zdGF0dXMpXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICBjYXNlIFwiZnVsZmlsbGVkXCI6XG4gICAgICAgICAgICAgIHJldHVybiB0aGVuYWJsZS52YWx1ZTtcbiAgICAgICAgICAgIGNhc2UgXCJyZWplY3RlZFwiOlxuICAgICAgICAgICAgICB0aHJvdyB0aGVuYWJsZS5yZWFzb247XG4gICAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhyb3cgdGhlbmFibGU7XG4gICAgfVxuICAgIGZ1bmN0aW9uIG1hcEludG9BcnJheShjaGlsZHJlbiwgYXJyYXksIGVzY2FwZWRQcmVmaXgsIG5hbWVTb0ZhciwgY2FsbGJhY2spIHtcbiAgICAgIHZhciB0eXBlID0gdHlwZW9mIGNoaWxkcmVuO1xuICAgICAgaWYgKFwidW5kZWZpbmVkXCIgPT09IHR5cGUgfHwgXCJib29sZWFuXCIgPT09IHR5cGUpIGNoaWxkcmVuID0gbnVsbDtcbiAgICAgIHZhciBpbnZva2VDYWxsYmFjayA9ICExO1xuICAgICAgaWYgKG51bGwgPT09IGNoaWxkcmVuKSBpbnZva2VDYWxsYmFjayA9ICEwO1xuICAgICAgZWxzZVxuICAgICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgICBjYXNlIFwiYmlnaW50XCI6XG4gICAgICAgICAgY2FzZSBcInN0cmluZ1wiOlxuICAgICAgICAgIGNhc2UgXCJudW1iZXJcIjpcbiAgICAgICAgICAgIGludm9rZUNhbGxiYWNrID0gITA7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICBjYXNlIFwib2JqZWN0XCI6XG4gICAgICAgICAgICBzd2l0Y2ggKGNoaWxkcmVuLiQkdHlwZW9mKSB7XG4gICAgICAgICAgICAgIGNhc2UgUkVBQ1RfRUxFTUVOVF9UWVBFOlxuICAgICAgICAgICAgICBjYXNlIFJFQUNUX1BPUlRBTF9UWVBFOlxuICAgICAgICAgICAgICAgIGludm9rZUNhbGxiYWNrID0gITA7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgUkVBQ1RfTEFaWV9UWVBFOlxuICAgICAgICAgICAgICAgIHJldHVybiAoXG4gICAgICAgICAgICAgICAgICAoaW52b2tlQ2FsbGJhY2sgPSBjaGlsZHJlbi5faW5pdCksXG4gICAgICAgICAgICAgICAgICBtYXBJbnRvQXJyYXkoXG4gICAgICAgICAgICAgICAgICAgIGludm9rZUNhbGxiYWNrKGNoaWxkcmVuLl9wYXlsb2FkKSxcbiAgICAgICAgICAgICAgICAgICAgYXJyYXksXG4gICAgICAgICAgICAgICAgICAgIGVzY2FwZWRQcmVmaXgsXG4gICAgICAgICAgICAgICAgICAgIG5hbWVTb0ZhcixcbiAgICAgICAgICAgICAgICAgICAgY2FsbGJhY2tcbiAgICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICBpZiAoaW52b2tlQ2FsbGJhY2spIHtcbiAgICAgICAgaW52b2tlQ2FsbGJhY2sgPSBjaGlsZHJlbjtcbiAgICAgICAgY2FsbGJhY2sgPSBjYWxsYmFjayhpbnZva2VDYWxsYmFjayk7XG4gICAgICAgIHZhciBjaGlsZEtleSA9XG4gICAgICAgICAgXCJcIiA9PT0gbmFtZVNvRmFyID8gXCIuXCIgKyBnZXRFbGVtZW50S2V5KGludm9rZUNhbGxiYWNrLCAwKSA6IG5hbWVTb0ZhcjtcbiAgICAgICAgaXNBcnJheUltcGwoY2FsbGJhY2spXG4gICAgICAgICAgPyAoKGVzY2FwZWRQcmVmaXggPSBcIlwiKSxcbiAgICAgICAgICAgIG51bGwgIT0gY2hpbGRLZXkgJiZcbiAgICAgICAgICAgICAgKGVzY2FwZWRQcmVmaXggPVxuICAgICAgICAgICAgICAgIGNoaWxkS2V5LnJlcGxhY2UodXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXgsIFwiJCYvXCIpICsgXCIvXCIpLFxuICAgICAgICAgICAgbWFwSW50b0FycmF5KGNhbGxiYWNrLCBhcnJheSwgZXNjYXBlZFByZWZpeCwgXCJcIiwgZnVuY3Rpb24gKGMpIHtcbiAgICAgICAgICAgICAgcmV0dXJuIGM7XG4gICAgICAgICAgICB9KSlcbiAgICAgICAgICA6IG51bGwgIT0gY2FsbGJhY2sgJiZcbiAgICAgICAgICAgIChpc1ZhbGlkRWxlbWVudChjYWxsYmFjaykgJiZcbiAgICAgICAgICAgICAgKG51bGwgIT0gY2FsbGJhY2sua2V5ICYmXG4gICAgICAgICAgICAgICAgKChpbnZva2VDYWxsYmFjayAmJiBpbnZva2VDYWxsYmFjay5rZXkgPT09IGNhbGxiYWNrLmtleSkgfHxcbiAgICAgICAgICAgICAgICAgIGNoZWNrS2V5U3RyaW5nQ29lcmNpb24oY2FsbGJhY2sua2V5KSksXG4gICAgICAgICAgICAgIChlc2NhcGVkUHJlZml4ID0gY2xvbmVBbmRSZXBsYWNlS2V5KFxuICAgICAgICAgICAgICAgIGNhbGxiYWNrLFxuICAgICAgICAgICAgICAgIGVzY2FwZWRQcmVmaXggK1xuICAgICAgICAgICAgICAgICAgKG51bGwgPT0gY2FsbGJhY2sua2V5IHx8XG4gICAgICAgICAgICAgICAgICAoaW52b2tlQ2FsbGJhY2sgJiYgaW52b2tlQ2FsbGJhY2sua2V5ID09PSBjYWxsYmFjay5rZXkpXG4gICAgICAgICAgICAgICAgICAgID8gXCJcIlxuICAgICAgICAgICAgICAgICAgICA6IChcIlwiICsgY2FsbGJhY2sua2V5KS5yZXBsYWNlKFxuICAgICAgICAgICAgICAgICAgICAgICAgdXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXgsXG4gICAgICAgICAgICAgICAgICAgICAgICBcIiQmL1wiXG4gICAgICAgICAgICAgICAgICAgICAgKSArIFwiL1wiKSArXG4gICAgICAgICAgICAgICAgICBjaGlsZEtleVxuICAgICAgICAgICAgICApKSxcbiAgICAgICAgICAgICAgXCJcIiAhPT0gbmFtZVNvRmFyICYmXG4gICAgICAgICAgICAgICAgbnVsbCAhPSBpbnZva2VDYWxsYmFjayAmJlxuICAgICAgICAgICAgICAgIGlzVmFsaWRFbGVtZW50KGludm9rZUNhbGxiYWNrKSAmJlxuICAgICAgICAgICAgICAgIG51bGwgPT0gaW52b2tlQ2FsbGJhY2sua2V5ICYmXG4gICAgICAgICAgICAgICAgaW52b2tlQ2FsbGJhY2suX3N0b3JlICYmXG4gICAgICAgICAgICAgICAgIWludm9rZUNhbGxiYWNrLl9zdG9yZS52YWxpZGF0ZWQgJiZcbiAgICAgICAgICAgICAgICAoZXNjYXBlZFByZWZpeC5fc3RvcmUudmFsaWRhdGVkID0gMiksXG4gICAgICAgICAgICAgIChjYWxsYmFjayA9IGVzY2FwZWRQcmVmaXgpKSxcbiAgICAgICAgICAgIGFycmF5LnB1c2goY2FsbGJhY2spKTtcbiAgICAgICAgcmV0dXJuIDE7XG4gICAgICB9XG4gICAgICBpbnZva2VDYWxsYmFjayA9IDA7XG4gICAgICBjaGlsZEtleSA9IFwiXCIgPT09IG5hbWVTb0ZhciA/IFwiLlwiIDogbmFtZVNvRmFyICsgXCI6XCI7XG4gICAgICBpZiAoaXNBcnJheUltcGwoY2hpbGRyZW4pKVxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNoaWxkcmVuLmxlbmd0aDsgaSsrKVxuICAgICAgICAgIChuYW1lU29GYXIgPSBjaGlsZHJlbltpXSksXG4gICAgICAgICAgICAodHlwZSA9IGNoaWxkS2V5ICsgZ2V0RWxlbWVudEtleShuYW1lU29GYXIsIGkpKSxcbiAgICAgICAgICAgIChpbnZva2VDYWxsYmFjayArPSBtYXBJbnRvQXJyYXkoXG4gICAgICAgICAgICAgIG5hbWVTb0ZhcixcbiAgICAgICAgICAgICAgYXJyYXksXG4gICAgICAgICAgICAgIGVzY2FwZWRQcmVmaXgsXG4gICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgIGNhbGxiYWNrXG4gICAgICAgICAgICApKTtcbiAgICAgIGVsc2UgaWYgKCgoaSA9IGdldEl0ZXJhdG9yRm4oY2hpbGRyZW4pKSwgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgaSkpXG4gICAgICAgIGZvciAoXG4gICAgICAgICAgaSA9PT0gY2hpbGRyZW4uZW50cmllcyAmJlxuICAgICAgICAgICAgKGRpZFdhcm5BYm91dE1hcHMgfHxcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICAgIFwiVXNpbmcgTWFwcyBhcyBjaGlsZHJlbiBpcyBub3Qgc3VwcG9ydGVkLiBVc2UgYW4gYXJyYXkgb2Yga2V5ZWQgUmVhY3RFbGVtZW50cyBpbnN0ZWFkLlwiXG4gICAgICAgICAgICAgICksXG4gICAgICAgICAgICAoZGlkV2FybkFib3V0TWFwcyA9ICEwKSksXG4gICAgICAgICAgICBjaGlsZHJlbiA9IGkuY2FsbChjaGlsZHJlbiksXG4gICAgICAgICAgICBpID0gMDtcbiAgICAgICAgICAhKG5hbWVTb0ZhciA9IGNoaWxkcmVuLm5leHQoKSkuZG9uZTtcblxuICAgICAgICApXG4gICAgICAgICAgKG5hbWVTb0ZhciA9IG5hbWVTb0Zhci52YWx1ZSksXG4gICAgICAgICAgICAodHlwZSA9IGNoaWxkS2V5ICsgZ2V0RWxlbWVudEtleShuYW1lU29GYXIsIGkrKykpLFxuICAgICAgICAgICAgKGludm9rZUNhbGxiYWNrICs9IG1hcEludG9BcnJheShcbiAgICAgICAgICAgICAgbmFtZVNvRmFyLFxuICAgICAgICAgICAgICBhcnJheSxcbiAgICAgICAgICAgICAgZXNjYXBlZFByZWZpeCxcbiAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgY2FsbGJhY2tcbiAgICAgICAgICAgICkpO1xuICAgICAgZWxzZSBpZiAoXCJvYmplY3RcIiA9PT0gdHlwZSkge1xuICAgICAgICBpZiAoXCJmdW5jdGlvblwiID09PSB0eXBlb2YgY2hpbGRyZW4udGhlbilcbiAgICAgICAgICByZXR1cm4gbWFwSW50b0FycmF5KFxuICAgICAgICAgICAgcmVzb2x2ZVRoZW5hYmxlKGNoaWxkcmVuKSxcbiAgICAgICAgICAgIGFycmF5LFxuICAgICAgICAgICAgZXNjYXBlZFByZWZpeCxcbiAgICAgICAgICAgIG5hbWVTb0ZhcixcbiAgICAgICAgICAgIGNhbGxiYWNrXG4gICAgICAgICAgKTtcbiAgICAgICAgYXJyYXkgPSBTdHJpbmcoY2hpbGRyZW4pO1xuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBcIk9iamVjdHMgYXJlIG5vdCB2YWxpZCBhcyBhIFJlYWN0IGNoaWxkIChmb3VuZDogXCIgK1xuICAgICAgICAgICAgKFwiW29iamVjdCBPYmplY3RdXCIgPT09IGFycmF5XG4gICAgICAgICAgICAgID8gXCJvYmplY3Qgd2l0aCBrZXlzIHtcIiArIE9iamVjdC5rZXlzKGNoaWxkcmVuKS5qb2luKFwiLCBcIikgKyBcIn1cIlxuICAgICAgICAgICAgICA6IGFycmF5KSArXG4gICAgICAgICAgICBcIikuIElmIHlvdSBtZWFudCB0byByZW5kZXIgYSBjb2xsZWN0aW9uIG9mIGNoaWxkcmVuLCB1c2UgYW4gYXJyYXkgaW5zdGVhZC5cIlxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGludm9rZUNhbGxiYWNrO1xuICAgIH1cbiAgICBmdW5jdGlvbiBtYXBDaGlsZHJlbihjaGlsZHJlbiwgZnVuYywgY29udGV4dCkge1xuICAgICAgaWYgKG51bGwgPT0gY2hpbGRyZW4pIHJldHVybiBjaGlsZHJlbjtcbiAgICAgIHZhciByZXN1bHQgPSBbXSxcbiAgICAgICAgY291bnQgPSAwO1xuICAgICAgbWFwSW50b0FycmF5KGNoaWxkcmVuLCByZXN1bHQsIFwiXCIsIFwiXCIsIGZ1bmN0aW9uIChjaGlsZCkge1xuICAgICAgICByZXR1cm4gZnVuYy5jYWxsKGNvbnRleHQsIGNoaWxkLCBjb3VudCsrKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG4gICAgZnVuY3Rpb24gbGF6eUluaXRpYWxpemVyKHBheWxvYWQpIHtcbiAgICAgIGlmICgtMSA9PT0gcGF5bG9hZC5fc3RhdHVzKSB7XG4gICAgICAgIHZhciBpb0luZm8gPSBwYXlsb2FkLl9pb0luZm87XG4gICAgICAgIG51bGwgIT0gaW9JbmZvICYmIChpb0luZm8uc3RhcnQgPSBpb0luZm8uZW5kID0gcGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICBpb0luZm8gPSBwYXlsb2FkLl9yZXN1bHQ7XG4gICAgICAgIHZhciB0aGVuYWJsZSA9IGlvSW5mbygpO1xuICAgICAgICB0aGVuYWJsZS50aGVuKFxuICAgICAgICAgIGZ1bmN0aW9uIChtb2R1bGVPYmplY3QpIHtcbiAgICAgICAgICAgIGlmICgwID09PSBwYXlsb2FkLl9zdGF0dXMgfHwgLTEgPT09IHBheWxvYWQuX3N0YXR1cykge1xuICAgICAgICAgICAgICBwYXlsb2FkLl9zdGF0dXMgPSAxO1xuICAgICAgICAgICAgICBwYXlsb2FkLl9yZXN1bHQgPSBtb2R1bGVPYmplY3Q7XG4gICAgICAgICAgICAgIHZhciBfaW9JbmZvID0gcGF5bG9hZC5faW9JbmZvO1xuICAgICAgICAgICAgICBudWxsICE9IF9pb0luZm8gJiYgKF9pb0luZm8uZW5kID0gcGVyZm9ybWFuY2Uubm93KCkpO1xuICAgICAgICAgICAgICB2b2lkIDAgPT09IHRoZW5hYmxlLnN0YXR1cyAmJlxuICAgICAgICAgICAgICAgICgodGhlbmFibGUuc3RhdHVzID0gXCJmdWxmaWxsZWRcIiksXG4gICAgICAgICAgICAgICAgKHRoZW5hYmxlLnZhbHVlID0gbW9kdWxlT2JqZWN0KSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgIGlmICgwID09PSBwYXlsb2FkLl9zdGF0dXMgfHwgLTEgPT09IHBheWxvYWQuX3N0YXR1cykge1xuICAgICAgICAgICAgICBwYXlsb2FkLl9zdGF0dXMgPSAyO1xuICAgICAgICAgICAgICBwYXlsb2FkLl9yZXN1bHQgPSBlcnJvcjtcbiAgICAgICAgICAgICAgdmFyIF9pb0luZm8yID0gcGF5bG9hZC5faW9JbmZvO1xuICAgICAgICAgICAgICBudWxsICE9IF9pb0luZm8yICYmIChfaW9JbmZvMi5lbmQgPSBwZXJmb3JtYW5jZS5ub3coKSk7XG4gICAgICAgICAgICAgIHZvaWQgMCA9PT0gdGhlbmFibGUuc3RhdHVzICYmXG4gICAgICAgICAgICAgICAgKCh0aGVuYWJsZS5zdGF0dXMgPSBcInJlamVjdGVkXCIpLCAodGhlbmFibGUucmVhc29uID0gZXJyb3IpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICAgIGlvSW5mbyA9IHBheWxvYWQuX2lvSW5mbztcbiAgICAgICAgaWYgKG51bGwgIT0gaW9JbmZvKSB7XG4gICAgICAgICAgaW9JbmZvLnZhbHVlID0gdGhlbmFibGU7XG4gICAgICAgICAgdmFyIGRpc3BsYXlOYW1lID0gdGhlbmFibGUuZGlzcGxheU5hbWU7XG4gICAgICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGRpc3BsYXlOYW1lICYmIChpb0luZm8ubmFtZSA9IGRpc3BsYXlOYW1lKTtcbiAgICAgICAgfVxuICAgICAgICAtMSA9PT0gcGF5bG9hZC5fc3RhdHVzICYmXG4gICAgICAgICAgKChwYXlsb2FkLl9zdGF0dXMgPSAwKSwgKHBheWxvYWQuX3Jlc3VsdCA9IHRoZW5hYmxlKSk7XG4gICAgICB9XG4gICAgICBpZiAoMSA9PT0gcGF5bG9hZC5fc3RhdHVzKVxuICAgICAgICByZXR1cm4gKFxuICAgICAgICAgIChpb0luZm8gPSBwYXlsb2FkLl9yZXN1bHQpLFxuICAgICAgICAgIHZvaWQgMCA9PT0gaW9JbmZvICYmXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcImxhenk6IEV4cGVjdGVkIHRoZSByZXN1bHQgb2YgYSBkeW5hbWljIGltcG9ydCgpIGNhbGwuIEluc3RlYWQgcmVjZWl2ZWQ6ICVzXFxuXFxuWW91ciBjb2RlIHNob3VsZCBsb29rIGxpa2U6IFxcbiAgY29uc3QgTXlDb21wb25lbnQgPSBsYXp5KCgpID0+IGltcG9ydCgnLi9NeUNvbXBvbmVudCcpKVxcblxcbkRpZCB5b3UgYWNjaWRlbnRhbGx5IHB1dCBjdXJseSBicmFjZXMgYXJvdW5kIHRoZSBpbXBvcnQ/XCIsXG4gICAgICAgICAgICAgIGlvSW5mb1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICBcImRlZmF1bHRcIiBpbiBpb0luZm8gfHxcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgIFwibGF6eTogRXhwZWN0ZWQgdGhlIHJlc3VsdCBvZiBhIGR5bmFtaWMgaW1wb3J0KCkgY2FsbC4gSW5zdGVhZCByZWNlaXZlZDogJXNcXG5cXG5Zb3VyIGNvZGUgc2hvdWxkIGxvb2sgbGlrZTogXFxuICBjb25zdCBNeUNvbXBvbmVudCA9IGxhenkoKCkgPT4gaW1wb3J0KCcuL015Q29tcG9uZW50JykpXCIsXG4gICAgICAgICAgICAgIGlvSW5mb1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICBpb0luZm8uZGVmYXVsdFxuICAgICAgICApO1xuICAgICAgdGhyb3cgcGF5bG9hZC5fcmVzdWx0O1xuICAgIH1cbiAgICBmdW5jdGlvbiByZXNvbHZlRGlzcGF0Y2hlcigpIHtcbiAgICAgIHZhciBkaXNwYXRjaGVyID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuSDtcbiAgICAgIG51bGwgPT09IGRpc3BhdGNoZXIgJiZcbiAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICBcIkludmFsaWQgaG9vayBjYWxsLiBIb29rcyBjYW4gb25seSBiZSBjYWxsZWQgaW5zaWRlIG9mIHRoZSBib2R5IG9mIGEgZnVuY3Rpb24gY29tcG9uZW50LiBUaGlzIGNvdWxkIGhhcHBlbiBmb3Igb25lIG9mIHRoZSBmb2xsb3dpbmcgcmVhc29uczpcXG4xLiBZb3UgbWlnaHQgaGF2ZSBtaXNtYXRjaGluZyB2ZXJzaW9ucyBvZiBSZWFjdCBhbmQgdGhlIHJlbmRlcmVyIChzdWNoIGFzIFJlYWN0IERPTSlcXG4yLiBZb3UgbWlnaHQgYmUgYnJlYWtpbmcgdGhlIFJ1bGVzIG9mIEhvb2tzXFxuMy4gWW91IG1pZ2h0IGhhdmUgbW9yZSB0aGFuIG9uZSBjb3B5IG9mIFJlYWN0IGluIHRoZSBzYW1lIGFwcFxcblNlZSBodHRwczovL3JlYWN0LmRldi9saW5rL2ludmFsaWQtaG9vay1jYWxsIGZvciB0aXBzIGFib3V0IGhvdyB0byBkZWJ1ZyBhbmQgZml4IHRoaXMgcHJvYmxlbS5cIlxuICAgICAgICApO1xuICAgICAgcmV0dXJuIGRpc3BhdGNoZXI7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlbGVhc2VBc3luY1RyYW5zaXRpb24oKSB7XG4gICAgICBSZWFjdFNoYXJlZEludGVybmFscy5hc3luY1RyYW5zaXRpb25zLS07XG4gICAgfVxuICAgIGZ1bmN0aW9uIGVucXVldWVUYXNrKHRhc2spIHtcbiAgICAgIGlmIChudWxsID09PSBlbnF1ZXVlVGFza0ltcGwpXG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdmFyIHJlcXVpcmVTdHJpbmcgPSAoXCJyZXF1aXJlXCIgKyBNYXRoLnJhbmRvbSgpKS5zbGljZSgwLCA3KTtcbiAgICAgICAgICBlbnF1ZXVlVGFza0ltcGwgPSAobW9kdWxlICYmIG1vZHVsZVtyZXF1aXJlU3RyaW5nXSkuY2FsbChcbiAgICAgICAgICAgIG1vZHVsZSxcbiAgICAgICAgICAgIFwidGltZXJzXCJcbiAgICAgICAgICApLnNldEltbWVkaWF0ZTtcbiAgICAgICAgfSBjYXRjaCAoX2Vycikge1xuICAgICAgICAgIGVucXVldWVUYXNrSW1wbCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgICAgICAgITEgPT09IGRpZFdhcm5BYm91dE1lc3NhZ2VDaGFubmVsICYmXG4gICAgICAgICAgICAgICgoZGlkV2FybkFib3V0TWVzc2FnZUNoYW5uZWwgPSAhMCksXG4gICAgICAgICAgICAgIFwidW5kZWZpbmVkXCIgPT09IHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAmJlxuICAgICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgICBcIlRoaXMgYnJvd3NlciBkb2VzIG5vdCBoYXZlIGEgTWVzc2FnZUNoYW5uZWwgaW1wbGVtZW50YXRpb24sIHNvIGVucXVldWluZyB0YXNrcyB2aWEgYXdhaXQgYWN0KGFzeW5jICgpID0+IC4uLikgd2lsbCBmYWlsLiBQbGVhc2UgZmlsZSBhbiBpc3N1ZSBhdCBodHRwczovL2dpdGh1Yi5jb20vZmFjZWJvb2svcmVhY3QvaXNzdWVzIGlmIHlvdSBlbmNvdW50ZXIgdGhpcyB3YXJuaW5nLlwiXG4gICAgICAgICAgICAgICAgKSk7XG4gICAgICAgICAgICB2YXIgY2hhbm5lbCA9IG5ldyBNZXNzYWdlQ2hhbm5lbCgpO1xuICAgICAgICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBjYWxsYmFjaztcbiAgICAgICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2Uodm9pZCAwKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICByZXR1cm4gZW5xdWV1ZVRhc2tJbXBsKHRhc2spO1xuICAgIH1cbiAgICBmdW5jdGlvbiBhZ2dyZWdhdGVFcnJvcnMoZXJyb3JzKSB7XG4gICAgICByZXR1cm4gMSA8IGVycm9ycy5sZW5ndGggJiYgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgQWdncmVnYXRlRXJyb3JcbiAgICAgICAgPyBuZXcgQWdncmVnYXRlRXJyb3IoZXJyb3JzKVxuICAgICAgICA6IGVycm9yc1swXTtcbiAgICB9XG4gICAgZnVuY3Rpb24gcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCkge1xuICAgICAgcHJldkFjdFNjb3BlRGVwdGggIT09IGFjdFNjb3BlRGVwdGggLSAxICYmXG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgXCJZb3Ugc2VlbSB0byBoYXZlIG92ZXJsYXBwaW5nIGFjdCgpIGNhbGxzLCB0aGlzIGlzIG5vdCBzdXBwb3J0ZWQuIEJlIHN1cmUgdG8gYXdhaXQgcHJldmlvdXMgYWN0KCkgY2FsbHMgYmVmb3JlIG1ha2luZyBhIG5ldyBvbmUuIFwiXG4gICAgICAgICk7XG4gICAgICBhY3RTY29wZURlcHRoID0gcHJldkFjdFNjb3BlRGVwdGg7XG4gICAgfVxuICAgIGZ1bmN0aW9uIHJlY3Vyc2l2ZWx5Rmx1c2hBc3luY0FjdFdvcmsocmV0dXJuVmFsdWUsIHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgdmFyIHF1ZXVlID0gUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWU7XG4gICAgICBpZiAobnVsbCAhPT0gcXVldWUpXG4gICAgICAgIGlmICgwICE9PSBxdWV1ZS5sZW5ndGgpXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGZsdXNoQWN0UXVldWUocXVldWUpO1xuICAgICAgICAgICAgZW5xdWV1ZVRhc2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICByZXR1cm4gcmVjdXJzaXZlbHlGbHVzaEFzeW5jQWN0V29yayhyZXR1cm5WYWx1ZSwgcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICBlbHNlIFJlYWN0U2hhcmVkSW50ZXJuYWxzLmFjdFF1ZXVlID0gbnVsbDtcbiAgICAgIDAgPCBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoXG4gICAgICAgID8gKChxdWV1ZSA9IGFnZ3JlZ2F0ZUVycm9ycyhSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMpKSxcbiAgICAgICAgICAoUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aCA9IDApLFxuICAgICAgICAgIHJlamVjdChxdWV1ZSkpXG4gICAgICAgIDogcmVzb2x2ZShyZXR1cm5WYWx1ZSk7XG4gICAgfVxuICAgIGZ1bmN0aW9uIGZsdXNoQWN0UXVldWUocXVldWUpIHtcbiAgICAgIGlmICghaXNGbHVzaGluZykge1xuICAgICAgICBpc0ZsdXNoaW5nID0gITA7XG4gICAgICAgIHZhciBpID0gMDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBmb3IgKDsgaSA8IHF1ZXVlLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICB2YXIgY2FsbGJhY2sgPSBxdWV1ZVtpXTtcbiAgICAgICAgICAgIGRvIHtcbiAgICAgICAgICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMuZGlkVXNlUHJvbWlzZSA9ICExO1xuICAgICAgICAgICAgICB2YXIgY29udGludWF0aW9uID0gY2FsbGJhY2soITEpO1xuICAgICAgICAgICAgICBpZiAobnVsbCAhPT0gY29udGludWF0aW9uKSB7XG4gICAgICAgICAgICAgICAgaWYgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLmRpZFVzZVByb21pc2UpIHtcbiAgICAgICAgICAgICAgICAgIHF1ZXVlW2ldID0gY2FsbGJhY2s7XG4gICAgICAgICAgICAgICAgICBxdWV1ZS5zcGxpY2UoMCwgaSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGNhbGxiYWNrID0gY29udGludWF0aW9uO1xuICAgICAgICAgICAgICB9IGVsc2UgYnJlYWs7XG4gICAgICAgICAgICB9IHdoaWxlICgxKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcXVldWUubGVuZ3RoID0gMDtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICBxdWV1ZS5zcGxpY2UoMCwgaSArIDEpLCBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMucHVzaChlcnJvcik7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgaXNGbHVzaGluZyA9ICExO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIFwidW5kZWZpbmVkXCIgIT09IHR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18gJiZcbiAgICAgIFwiZnVuY3Rpb25cIiA9PT1cbiAgICAgICAgdHlwZW9mIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RhcnQgJiZcbiAgICAgIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RhcnQoRXJyb3IoKSk7XG4gICAgdmFyIFJFQUNUX0VMRU1FTlRfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC50cmFuc2l0aW9uYWwuZWxlbWVudFwiKSxcbiAgICAgIFJFQUNUX1BPUlRBTF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnBvcnRhbFwiKSxcbiAgICAgIFJFQUNUX0ZSQUdNRU5UX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZnJhZ21lbnRcIiksXG4gICAgICBSRUFDVF9TVFJJQ1RfTU9ERV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN0cmljdF9tb2RlXCIpLFxuICAgICAgUkVBQ1RfUFJPRklMRVJfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5wcm9maWxlclwiKSxcbiAgICAgIFJFQUNUX0NPTlNVTUVSX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29uc3VtZXJcIiksXG4gICAgICBSRUFDVF9DT05URVhUX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuY29udGV4dFwiKSxcbiAgICAgIFJFQUNUX0ZPUldBUkRfUkVGX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QuZm9yd2FyZF9yZWZcIiksXG4gICAgICBSRUFDVF9TVVNQRU5TRV9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlXCIpLFxuICAgICAgUkVBQ1RfU1VTUEVOU0VfTElTVF9UWVBFID0gU3ltYm9sLmZvcihcInJlYWN0LnN1c3BlbnNlX2xpc3RcIiksXG4gICAgICBSRUFDVF9NRU1PX1RZUEUgPSBTeW1ib2wuZm9yKFwicmVhY3QubWVtb1wiKSxcbiAgICAgIFJFQUNUX0xBWllfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5sYXp5XCIpLFxuICAgICAgUkVBQ1RfQUNUSVZJVFlfVFlQRSA9IFN5bWJvbC5mb3IoXCJyZWFjdC5hY3Rpdml0eVwiKSxcbiAgICAgIE1BWUJFX0lURVJBVE9SX1NZTUJPTCA9IFN5bWJvbC5pdGVyYXRvcixcbiAgICAgIGRpZFdhcm5TdGF0ZVVwZGF0ZUZvclVubW91bnRlZENvbXBvbmVudCA9IHt9LFxuICAgICAgUmVhY3ROb29wVXBkYXRlUXVldWUgPSB7XG4gICAgICAgIGlzTW91bnRlZDogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIHJldHVybiAhMTtcbiAgICAgICAgfSxcbiAgICAgICAgZW5xdWV1ZUZvcmNlVXBkYXRlOiBmdW5jdGlvbiAocHVibGljSW5zdGFuY2UpIHtcbiAgICAgICAgICB3YXJuTm9vcChwdWJsaWNJbnN0YW5jZSwgXCJmb3JjZVVwZGF0ZVwiKTtcbiAgICAgICAgfSxcbiAgICAgICAgZW5xdWV1ZVJlcGxhY2VTdGF0ZTogZnVuY3Rpb24gKHB1YmxpY0luc3RhbmNlKSB7XG4gICAgICAgICAgd2Fybk5vb3AocHVibGljSW5zdGFuY2UsIFwicmVwbGFjZVN0YXRlXCIpO1xuICAgICAgICB9LFxuICAgICAgICBlbnF1ZXVlU2V0U3RhdGU6IGZ1bmN0aW9uIChwdWJsaWNJbnN0YW5jZSkge1xuICAgICAgICAgIHdhcm5Ob29wKHB1YmxpY0luc3RhbmNlLCBcInNldFN0YXRlXCIpO1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAgYXNzaWduID0gT2JqZWN0LmFzc2lnbixcbiAgICAgIGVtcHR5T2JqZWN0ID0ge307XG4gICAgT2JqZWN0LmZyZWV6ZShlbXB0eU9iamVjdCk7XG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5pc1JlYWN0Q29tcG9uZW50ID0ge307XG4gICAgQ29tcG9uZW50LnByb3RvdHlwZS5zZXRTdGF0ZSA9IGZ1bmN0aW9uIChwYXJ0aWFsU3RhdGUsIGNhbGxiYWNrKSB7XG4gICAgICBpZiAoXG4gICAgICAgIFwib2JqZWN0XCIgIT09IHR5cGVvZiBwYXJ0aWFsU3RhdGUgJiZcbiAgICAgICAgXCJmdW5jdGlvblwiICE9PSB0eXBlb2YgcGFydGlhbFN0YXRlICYmXG4gICAgICAgIG51bGwgIT0gcGFydGlhbFN0YXRlXG4gICAgICApXG4gICAgICAgIHRocm93IEVycm9yKFxuICAgICAgICAgIFwidGFrZXMgYW4gb2JqZWN0IG9mIHN0YXRlIHZhcmlhYmxlcyB0byB1cGRhdGUgb3IgYSBmdW5jdGlvbiB3aGljaCByZXR1cm5zIGFuIG9iamVjdCBvZiBzdGF0ZSB2YXJpYWJsZXMuXCJcbiAgICAgICAgKTtcbiAgICAgIHRoaXMudXBkYXRlci5lbnF1ZXVlU2V0U3RhdGUodGhpcywgcGFydGlhbFN0YXRlLCBjYWxsYmFjaywgXCJzZXRTdGF0ZVwiKTtcbiAgICB9O1xuICAgIENvbXBvbmVudC5wcm90b3R5cGUuZm9yY2VVcGRhdGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHRoaXMudXBkYXRlci5lbnF1ZXVlRm9yY2VVcGRhdGUodGhpcywgY2FsbGJhY2ssIFwiZm9yY2VVcGRhdGVcIik7XG4gICAgfTtcbiAgICB2YXIgZGVwcmVjYXRlZEFQSXMgPSB7XG4gICAgICBpc01vdW50ZWQ6IFtcbiAgICAgICAgXCJpc01vdW50ZWRcIixcbiAgICAgICAgXCJJbnN0ZWFkLCBtYWtlIHN1cmUgdG8gY2xlYW4gdXAgc3Vic2NyaXB0aW9ucyBhbmQgcGVuZGluZyByZXF1ZXN0cyBpbiBjb21wb25lbnRXaWxsVW5tb3VudCB0byBwcmV2ZW50IG1lbW9yeSBsZWFrcy5cIlxuICAgICAgXSxcbiAgICAgIHJlcGxhY2VTdGF0ZTogW1xuICAgICAgICBcInJlcGxhY2VTdGF0ZVwiLFxuICAgICAgICBcIlJlZmFjdG9yIHlvdXIgY29kZSB0byB1c2Ugc2V0U3RhdGUgaW5zdGVhZCAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9mYWNlYm9vay9yZWFjdC9pc3N1ZXMvMzIzNikuXCJcbiAgICAgIF1cbiAgICB9O1xuICAgIGZvciAoZm5OYW1lIGluIGRlcHJlY2F0ZWRBUElzKVxuICAgICAgZGVwcmVjYXRlZEFQSXMuaGFzT3duUHJvcGVydHkoZm5OYW1lKSAmJlxuICAgICAgICBkZWZpbmVEZXByZWNhdGlvbldhcm5pbmcoZm5OYW1lLCBkZXByZWNhdGVkQVBJc1tmbk5hbWVdKTtcbiAgICBDb21wb25lbnREdW1teS5wcm90b3R5cGUgPSBDb21wb25lbnQucHJvdG90eXBlO1xuICAgIGRlcHJlY2F0ZWRBUElzID0gUHVyZUNvbXBvbmVudC5wcm90b3R5cGUgPSBuZXcgQ29tcG9uZW50RHVtbXkoKTtcbiAgICBkZXByZWNhdGVkQVBJcy5jb25zdHJ1Y3RvciA9IFB1cmVDb21wb25lbnQ7XG4gICAgYXNzaWduKGRlcHJlY2F0ZWRBUElzLCBDb21wb25lbnQucHJvdG90eXBlKTtcbiAgICBkZXByZWNhdGVkQVBJcy5pc1B1cmVSZWFjdENvbXBvbmVudCA9ICEwO1xuICAgIHZhciBpc0FycmF5SW1wbCA9IEFycmF5LmlzQXJyYXksXG4gICAgICBSRUFDVF9DTElFTlRfUkVGRVJFTkNFID0gU3ltYm9sLmZvcihcInJlYWN0LmNsaWVudC5yZWZlcmVuY2VcIiksXG4gICAgICBSZWFjdFNoYXJlZEludGVybmFscyA9IHtcbiAgICAgICAgSDogbnVsbCxcbiAgICAgICAgQTogbnVsbCxcbiAgICAgICAgVDogbnVsbCxcbiAgICAgICAgUzogbnVsbCxcbiAgICAgICAgYWN0UXVldWU6IG51bGwsXG4gICAgICAgIGFzeW5jVHJhbnNpdGlvbnM6IDAsXG4gICAgICAgIGlzQmF0Y2hpbmdMZWdhY3k6ICExLFxuICAgICAgICBkaWRTY2hlZHVsZUxlZ2FjeVVwZGF0ZTogITEsXG4gICAgICAgIGRpZFVzZVByb21pc2U6ICExLFxuICAgICAgICB0aHJvd25FcnJvcnM6IFtdLFxuICAgICAgICBnZXRDdXJyZW50U3RhY2s6IG51bGwsXG4gICAgICAgIHJlY2VudGx5Q3JlYXRlZE93bmVyU3RhY2tzOiAwXG4gICAgICB9LFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LFxuICAgICAgY3JlYXRlVGFzayA9IGNvbnNvbGUuY3JlYXRlVGFza1xuICAgICAgICA/IGNvbnNvbGUuY3JlYXRlVGFza1xuICAgICAgICA6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICAgIH07XG4gICAgZGVwcmVjYXRlZEFQSXMgPSB7XG4gICAgICByZWFjdF9zdGFja19ib3R0b21fZnJhbWU6IGZ1bmN0aW9uIChjYWxsU3RhY2tGb3JFcnJvcikge1xuICAgICAgICByZXR1cm4gY2FsbFN0YWNrRm9yRXJyb3IoKTtcbiAgICAgIH1cbiAgICB9O1xuICAgIHZhciBzcGVjaWFsUHJvcEtleVdhcm5pbmdTaG93biwgZGlkV2FybkFib3V0T2xkSlNYUnVudGltZTtcbiAgICB2YXIgZGlkV2FybkFib3V0RWxlbWVudFJlZiA9IHt9O1xuICAgIHZhciB1bmtub3duT3duZXJEZWJ1Z1N0YWNrID0gZGVwcmVjYXRlZEFQSXMucmVhY3Rfc3RhY2tfYm90dG9tX2ZyYW1lLmJpbmQoXG4gICAgICBkZXByZWNhdGVkQVBJcyxcbiAgICAgIFVua25vd25Pd25lclxuICAgICkoKTtcbiAgICB2YXIgdW5rbm93bk93bmVyRGVidWdUYXNrID0gY3JlYXRlVGFzayhnZXRUYXNrTmFtZShVbmtub3duT3duZXIpKTtcbiAgICB2YXIgZGlkV2FybkFib3V0TWFwcyA9ICExLFxuICAgICAgdXNlclByb3ZpZGVkS2V5RXNjYXBlUmVnZXggPSAvXFwvKy9nLFxuICAgICAgcmVwb3J0R2xvYmFsRXJyb3IgPVxuICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiByZXBvcnRFcnJvclxuICAgICAgICAgID8gcmVwb3J0RXJyb3JcbiAgICAgICAgICA6IGZ1bmN0aW9uIChlcnJvcikge1xuICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHdpbmRvdyAmJlxuICAgICAgICAgICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHdpbmRvdy5FcnJvckV2ZW50XG4gICAgICAgICAgICAgICkge1xuICAgICAgICAgICAgICAgIHZhciBldmVudCA9IG5ldyB3aW5kb3cuRXJyb3JFdmVudChcImVycm9yXCIsIHtcbiAgICAgICAgICAgICAgICAgIGJ1YmJsZXM6ICEwLFxuICAgICAgICAgICAgICAgICAgY2FuY2VsYWJsZTogITAsXG4gICAgICAgICAgICAgICAgICBtZXNzYWdlOlxuICAgICAgICAgICAgICAgICAgICBcIm9iamVjdFwiID09PSB0eXBlb2YgZXJyb3IgJiZcbiAgICAgICAgICAgICAgICAgICAgbnVsbCAhPT0gZXJyb3IgJiZcbiAgICAgICAgICAgICAgICAgICAgXCJzdHJpbmdcIiA9PT0gdHlwZW9mIGVycm9yLm1lc3NhZ2VcbiAgICAgICAgICAgICAgICAgICAgICA/IFN0cmluZyhlcnJvci5tZXNzYWdlKVxuICAgICAgICAgICAgICAgICAgICAgIDogU3RyaW5nKGVycm9yKSxcbiAgICAgICAgICAgICAgICAgIGVycm9yOiBlcnJvclxuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIGlmICghd2luZG93LmRpc3BhdGNoRXZlbnQoZXZlbnQpKSByZXR1cm47XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICAgICAgICAgXCJvYmplY3RcIiA9PT0gdHlwZW9mIHByb2Nlc3MgJiZcbiAgICAgICAgICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBwcm9jZXNzLmVtaXRcbiAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgcHJvY2Vzcy5lbWl0KFwidW5jYXVnaHRFeGNlcHRpb25cIiwgZXJyb3IpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGVycm9yKTtcbiAgICAgICAgICAgIH0sXG4gICAgICBkaWRXYXJuQWJvdXRNZXNzYWdlQ2hhbm5lbCA9ICExLFxuICAgICAgZW5xdWV1ZVRhc2tJbXBsID0gbnVsbCxcbiAgICAgIGFjdFNjb3BlRGVwdGggPSAwLFxuICAgICAgZGlkV2Fybk5vQXdhaXRBY3QgPSAhMSxcbiAgICAgIGlzRmx1c2hpbmcgPSAhMSxcbiAgICAgIHF1ZXVlU2V2ZXJhbE1pY3JvdGFza3MgPVxuICAgICAgICBcImZ1bmN0aW9uXCIgPT09IHR5cGVvZiBxdWV1ZU1pY3JvdGFza1xuICAgICAgICAgID8gZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIHF1ZXVlTWljcm90YXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcXVldWVNaWNyb3Rhc2soY2FsbGJhY2spO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICA6IGVucXVldWVUYXNrO1xuICAgIGRlcHJlY2F0ZWRBUElzID0gT2JqZWN0LmZyZWV6ZSh7XG4gICAgICBfX3Byb3RvX186IG51bGwsXG4gICAgICBjOiBmdW5jdGlvbiAoc2l6ZSkge1xuICAgICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VNZW1vQ2FjaGUoc2l6ZSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgdmFyIGZuTmFtZSA9IHtcbiAgICAgIG1hcDogbWFwQ2hpbGRyZW4sXG4gICAgICBmb3JFYWNoOiBmdW5jdGlvbiAoY2hpbGRyZW4sIGZvckVhY2hGdW5jLCBmb3JFYWNoQ29udGV4dCkge1xuICAgICAgICBtYXBDaGlsZHJlbihcbiAgICAgICAgICBjaGlsZHJlbixcbiAgICAgICAgICBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBmb3JFYWNoRnVuYy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgZm9yRWFjaENvbnRleHRcbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBjb3VudDogZnVuY3Rpb24gKGNoaWxkcmVuKSB7XG4gICAgICAgIHZhciBuID0gMDtcbiAgICAgICAgbWFwQ2hpbGRyZW4oY2hpbGRyZW4sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICBuKys7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gbjtcbiAgICAgIH0sXG4gICAgICB0b0FycmF5OiBmdW5jdGlvbiAoY2hpbGRyZW4pIHtcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICBtYXBDaGlsZHJlbihjaGlsZHJlbiwgZnVuY3Rpb24gKGNoaWxkKSB7XG4gICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgICAgfSkgfHwgW11cbiAgICAgICAgKTtcbiAgICAgIH0sXG4gICAgICBvbmx5OiBmdW5jdGlvbiAoY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKCFpc1ZhbGlkRWxlbWVudChjaGlsZHJlbikpXG4gICAgICAgICAgdGhyb3cgRXJyb3IoXG4gICAgICAgICAgICBcIlJlYWN0LkNoaWxkcmVuLm9ubHkgZXhwZWN0ZWQgdG8gcmVjZWl2ZSBhIHNpbmdsZSBSZWFjdCBlbGVtZW50IGNoaWxkLlwiXG4gICAgICAgICAgKTtcbiAgICAgICAgcmV0dXJuIGNoaWxkcmVuO1xuICAgICAgfVxuICAgIH07XG4gICAgZXhwb3J0cy5BY3Rpdml0eSA9IFJFQUNUX0FDVElWSVRZX1RZUEU7XG4gICAgZXhwb3J0cy5DaGlsZHJlbiA9IGZuTmFtZTtcbiAgICBleHBvcnRzLkNvbXBvbmVudCA9IENvbXBvbmVudDtcbiAgICBleHBvcnRzLkZyYWdtZW50ID0gUkVBQ1RfRlJBR01FTlRfVFlQRTtcbiAgICBleHBvcnRzLlByb2ZpbGVyID0gUkVBQ1RfUFJPRklMRVJfVFlQRTtcbiAgICBleHBvcnRzLlB1cmVDb21wb25lbnQgPSBQdXJlQ29tcG9uZW50O1xuICAgIGV4cG9ydHMuU3RyaWN0TW9kZSA9IFJFQUNUX1NUUklDVF9NT0RFX1RZUEU7XG4gICAgZXhwb3J0cy5TdXNwZW5zZSA9IFJFQUNUX1NVU1BFTlNFX1RZUEU7XG4gICAgZXhwb3J0cy5fX0NMSUVOVF9JTlRFUk5BTFNfRE9fTk9UX1VTRV9PUl9XQVJOX1VTRVJTX1RIRVlfQ0FOTk9UX1VQR1JBREUgPVxuICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHM7XG4gICAgZXhwb3J0cy5fX0NPTVBJTEVSX1JVTlRJTUUgPSBkZXByZWNhdGVkQVBJcztcbiAgICBleHBvcnRzLmFjdCA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgICAgdmFyIHByZXZBY3RRdWV1ZSA9IFJlYWN0U2hhcmVkSW50ZXJuYWxzLmFjdFF1ZXVlLFxuICAgICAgICBwcmV2QWN0U2NvcGVEZXB0aCA9IGFjdFNjb3BlRGVwdGg7XG4gICAgICBhY3RTY29wZURlcHRoKys7XG4gICAgICB2YXIgcXVldWUgPSAoUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWUgPVxuICAgICAgICAgIG51bGwgIT09IHByZXZBY3RRdWV1ZSA/IHByZXZBY3RRdWV1ZSA6IFtdKSxcbiAgICAgICAgZGlkQXdhaXRBY3RDYWxsID0gITE7XG4gICAgICB0cnkge1xuICAgICAgICB2YXIgcmVzdWx0ID0gY2FsbGJhY2soKTtcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5wdXNoKGVycm9yKTtcbiAgICAgIH1cbiAgICAgIGlmICgwIDwgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aClcbiAgICAgICAgdGhyb3cgKFxuICAgICAgICAgIChwb3BBY3RTY29wZShwcmV2QWN0UXVldWUsIHByZXZBY3RTY29wZURlcHRoKSxcbiAgICAgICAgICAoY2FsbGJhY2sgPSBhZ2dyZWdhdGVFcnJvcnMoUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzKSksXG4gICAgICAgICAgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGggPSAwKSxcbiAgICAgICAgICBjYWxsYmFjaylcbiAgICAgICAgKTtcbiAgICAgIGlmIChcbiAgICAgICAgbnVsbCAhPT0gcmVzdWx0ICYmXG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiByZXN1bHQgJiZcbiAgICAgICAgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgcmVzdWx0LnRoZW5cbiAgICAgICkge1xuICAgICAgICB2YXIgdGhlbmFibGUgPSByZXN1bHQ7XG4gICAgICAgIHF1ZXVlU2V2ZXJhbE1pY3JvdGFza3MoZnVuY3Rpb24gKCkge1xuICAgICAgICAgIGRpZEF3YWl0QWN0Q2FsbCB8fFxuICAgICAgICAgICAgZGlkV2Fybk5vQXdhaXRBY3QgfHxcbiAgICAgICAgICAgICgoZGlkV2Fybk5vQXdhaXRBY3QgPSAhMCksXG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgICBcIllvdSBjYWxsZWQgYWN0KGFzeW5jICgpID0+IC4uLikgd2l0aG91dCBhd2FpdC4gVGhpcyBjb3VsZCBsZWFkIHRvIHVuZXhwZWN0ZWQgdGVzdGluZyBiZWhhdmlvdXIsIGludGVybGVhdmluZyBtdWx0aXBsZSBhY3QgY2FsbHMgYW5kIG1peGluZyB0aGVpciBzY29wZXMuIFlvdSBzaG91bGQgLSBhd2FpdCBhY3QoYXN5bmMgKCkgPT4gLi4uKTtcIlxuICAgICAgICAgICAgKSk7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHRoZW46IGZ1bmN0aW9uIChyZXNvbHZlLCByZWplY3QpIHtcbiAgICAgICAgICAgIGRpZEF3YWl0QWN0Q2FsbCA9ICEwO1xuICAgICAgICAgICAgdGhlbmFibGUudGhlbihcbiAgICAgICAgICAgICAgZnVuY3Rpb24gKHJldHVyblZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCk7XG4gICAgICAgICAgICAgICAgaWYgKDAgPT09IHByZXZBY3RTY29wZURlcHRoKSB7XG4gICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICBmbHVzaEFjdFF1ZXVlKHF1ZXVlKSxcbiAgICAgICAgICAgICAgICAgICAgICBlbnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gcmVjdXJzaXZlbHlGbHVzaEFzeW5jQWN0V29yayhcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuVmFsdWUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlc29sdmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdFxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yJDApIHtcbiAgICAgICAgICAgICAgICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLnB1c2goZXJyb3IkMCk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICBpZiAoMCA8IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGgpIHtcbiAgICAgICAgICAgICAgICAgICAgdmFyIF90aHJvd25FcnJvciA9IGFnZ3JlZ2F0ZUVycm9ycyhcbiAgICAgICAgICAgICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnNcbiAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgUmVhY3RTaGFyZWRJbnRlcm5hbHMudGhyb3duRXJyb3JzLmxlbmd0aCA9IDA7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChfdGhyb3duRXJyb3IpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH0gZWxzZSByZXNvbHZlKHJldHVyblZhbHVlKTtcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgICAgICAgICAgcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCk7XG4gICAgICAgICAgICAgICAgMCA8IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGhcbiAgICAgICAgICAgICAgICAgID8gKChlcnJvciA9IGFnZ3JlZ2F0ZUVycm9ycyhcbiAgICAgICAgICAgICAgICAgICAgICBSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnNcbiAgICAgICAgICAgICAgICAgICAgKSksXG4gICAgICAgICAgICAgICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoID0gMCksXG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChlcnJvcikpXG4gICAgICAgICAgICAgICAgICA6IHJlamVjdChlcnJvcik7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdmFyIHJldHVyblZhbHVlJGpzY29tcCQwID0gcmVzdWx0O1xuICAgICAgcG9wQWN0U2NvcGUocHJldkFjdFF1ZXVlLCBwcmV2QWN0U2NvcGVEZXB0aCk7XG4gICAgICAwID09PSBwcmV2QWN0U2NvcGVEZXB0aCAmJlxuICAgICAgICAoZmx1c2hBY3RRdWV1ZShxdWV1ZSksXG4gICAgICAgIDAgIT09IHF1ZXVlLmxlbmd0aCAmJlxuICAgICAgICAgIHF1ZXVlU2V2ZXJhbE1pY3JvdGFza3MoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgZGlkQXdhaXRBY3RDYWxsIHx8XG4gICAgICAgICAgICAgIGRpZFdhcm5Ob0F3YWl0QWN0IHx8XG4gICAgICAgICAgICAgICgoZGlkV2Fybk5vQXdhaXRBY3QgPSAhMCksXG4gICAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXG4gICAgICAgICAgICAgICAgXCJBIGNvbXBvbmVudCBzdXNwZW5kZWQgaW5zaWRlIGFuIGBhY3RgIHNjb3BlLCBidXQgdGhlIGBhY3RgIGNhbGwgd2FzIG5vdCBhd2FpdGVkLiBXaGVuIHRlc3RpbmcgUmVhY3QgY29tcG9uZW50cyB0aGF0IGRlcGVuZCBvbiBhc3luY2hyb25vdXMgZGF0YSwgeW91IG11c3QgYXdhaXQgdGhlIHJlc3VsdDpcXG5cXG5hd2FpdCBhY3QoKCkgPT4gLi4uKVwiXG4gICAgICAgICAgICAgICkpO1xuICAgICAgICAgIH0pLFxuICAgICAgICAoUmVhY3RTaGFyZWRJbnRlcm5hbHMuYWN0UXVldWUgPSBudWxsKSk7XG4gICAgICBpZiAoMCA8IFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycy5sZW5ndGgpXG4gICAgICAgIHRocm93IChcbiAgICAgICAgICAoKGNhbGxiYWNrID0gYWdncmVnYXRlRXJyb3JzKFJlYWN0U2hhcmVkSW50ZXJuYWxzLnRocm93bkVycm9ycykpLFxuICAgICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy50aHJvd25FcnJvcnMubGVuZ3RoID0gMCksXG4gICAgICAgICAgY2FsbGJhY2spXG4gICAgICAgICk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB0aGVuOiBmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICAgICAgZGlkQXdhaXRBY3RDYWxsID0gITA7XG4gICAgICAgICAgMCA9PT0gcHJldkFjdFNjb3BlRGVwdGhcbiAgICAgICAgICAgID8gKChSZWFjdFNoYXJlZEludGVybmFscy5hY3RRdWV1ZSA9IHF1ZXVlKSxcbiAgICAgICAgICAgICAgZW5xdWV1ZVRhc2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWN1cnNpdmVseUZsdXNoQXN5bmNBY3RXb3JrKFxuICAgICAgICAgICAgICAgICAgcmV0dXJuVmFsdWUkanNjb21wJDAsXG4gICAgICAgICAgICAgICAgICByZXNvbHZlLFxuICAgICAgICAgICAgICAgICAgcmVqZWN0XG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICA6IHJlc29sdmUocmV0dXJuVmFsdWUkanNjb21wJDApO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH07XG4gICAgZXhwb3J0cy5jYWNoZSA9IGZ1bmN0aW9uIChmbikge1xuICAgICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGZuLmFwcGx5KG51bGwsIGFyZ3VtZW50cyk7XG4gICAgICB9O1xuICAgIH07XG4gICAgZXhwb3J0cy5jYWNoZVNpZ25hbCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH07XG4gICAgZXhwb3J0cy5jYXB0dXJlT3duZXJTdGFjayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBnZXRDdXJyZW50U3RhY2sgPSBSZWFjdFNoYXJlZEludGVybmFscy5nZXRDdXJyZW50U3RhY2s7XG4gICAgICByZXR1cm4gbnVsbCA9PT0gZ2V0Q3VycmVudFN0YWNrID8gbnVsbCA6IGdldEN1cnJlbnRTdGFjaygpO1xuICAgIH07XG4gICAgZXhwb3J0cy5jbG9uZUVsZW1lbnQgPSBmdW5jdGlvbiAoZWxlbWVudCwgY29uZmlnLCBjaGlsZHJlbikge1xuICAgICAgaWYgKG51bGwgPT09IGVsZW1lbnQgfHwgdm9pZCAwID09PSBlbGVtZW50KVxuICAgICAgICB0aHJvdyBFcnJvcihcbiAgICAgICAgICBcIlRoZSBhcmd1bWVudCBtdXN0IGJlIGEgUmVhY3QgZWxlbWVudCwgYnV0IHlvdSBwYXNzZWQgXCIgK1xuICAgICAgICAgICAgZWxlbWVudCArXG4gICAgICAgICAgICBcIi5cIlxuICAgICAgICApO1xuICAgICAgdmFyIHByb3BzID0gYXNzaWduKHt9LCBlbGVtZW50LnByb3BzKSxcbiAgICAgICAga2V5ID0gZWxlbWVudC5rZXksXG4gICAgICAgIG93bmVyID0gZWxlbWVudC5fb3duZXI7XG4gICAgICBpZiAobnVsbCAhPSBjb25maWcpIHtcbiAgICAgICAgdmFyIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdDtcbiAgICAgICAgYToge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBcInJlZlwiKSAmJlxuICAgICAgICAgICAgKEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3IoXG4gICAgICAgICAgICAgIGNvbmZpZyxcbiAgICAgICAgICAgICAgXCJyZWZcIlxuICAgICAgICAgICAgKS5nZXQpICYmXG4gICAgICAgICAgICBKU0NvbXBpbGVyX2lubGluZV9yZXN1bHQuaXNSZWFjdFdhcm5pbmdcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9ICExO1xuICAgICAgICAgICAgYnJlYWsgYTtcbiAgICAgICAgICB9XG4gICAgICAgICAgSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0ID0gdm9pZCAwICE9PSBjb25maWcucmVmO1xuICAgICAgICB9XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCAmJiAob3duZXIgPSBnZXRPd25lcigpKTtcbiAgICAgICAgaGFzVmFsaWRLZXkoY29uZmlnKSAmJlxuICAgICAgICAgIChjaGVja0tleVN0cmluZ0NvZXJjaW9uKGNvbmZpZy5rZXkpLCAoa2V5ID0gXCJcIiArIGNvbmZpZy5rZXkpKTtcbiAgICAgICAgZm9yIChwcm9wTmFtZSBpbiBjb25maWcpXG4gICAgICAgICAgIWhhc093blByb3BlcnR5LmNhbGwoY29uZmlnLCBwcm9wTmFtZSkgfHxcbiAgICAgICAgICAgIFwia2V5XCIgPT09IHByb3BOYW1lIHx8XG4gICAgICAgICAgICBcIl9fc2VsZlwiID09PSBwcm9wTmFtZSB8fFxuICAgICAgICAgICAgXCJfX3NvdXJjZVwiID09PSBwcm9wTmFtZSB8fFxuICAgICAgICAgICAgKFwicmVmXCIgPT09IHByb3BOYW1lICYmIHZvaWQgMCA9PT0gY29uZmlnLnJlZikgfHxcbiAgICAgICAgICAgIChwcm9wc1twcm9wTmFtZV0gPSBjb25maWdbcHJvcE5hbWVdKTtcbiAgICAgIH1cbiAgICAgIHZhciBwcm9wTmFtZSA9IGFyZ3VtZW50cy5sZW5ndGggLSAyO1xuICAgICAgaWYgKDEgPT09IHByb3BOYW1lKSBwcm9wcy5jaGlsZHJlbiA9IGNoaWxkcmVuO1xuICAgICAgZWxzZSBpZiAoMSA8IHByb3BOYW1lKSB7XG4gICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdCA9IEFycmF5KHByb3BOYW1lKTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wTmFtZTsgaSsrKVxuICAgICAgICAgIEpTQ29tcGlsZXJfaW5saW5lX3Jlc3VsdFtpXSA9IGFyZ3VtZW50c1tpICsgMl07XG4gICAgICAgIHByb3BzLmNoaWxkcmVuID0gSlNDb21waWxlcl9pbmxpbmVfcmVzdWx0O1xuICAgICAgfVxuICAgICAgcHJvcHMgPSBSZWFjdEVsZW1lbnQoXG4gICAgICAgIGVsZW1lbnQudHlwZSxcbiAgICAgICAga2V5LFxuICAgICAgICBwcm9wcyxcbiAgICAgICAgb3duZXIsXG4gICAgICAgIGVsZW1lbnQuX2RlYnVnU3RhY2ssXG4gICAgICAgIGVsZW1lbnQuX2RlYnVnVGFza1xuICAgICAgKTtcbiAgICAgIGZvciAoa2V5ID0gMjsga2V5IDwgYXJndW1lbnRzLmxlbmd0aDsga2V5KyspXG4gICAgICAgIHZhbGlkYXRlQ2hpbGRLZXlzKGFyZ3VtZW50c1trZXldKTtcbiAgICAgIHJldHVybiBwcm9wcztcbiAgICB9O1xuICAgIGV4cG9ydHMuY3JlYXRlQ29udGV4dCA9IGZ1bmN0aW9uIChkZWZhdWx0VmFsdWUpIHtcbiAgICAgIGRlZmF1bHRWYWx1ZSA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0NPTlRFWFRfVFlQRSxcbiAgICAgICAgX2N1cnJlbnRWYWx1ZTogZGVmYXVsdFZhbHVlLFxuICAgICAgICBfY3VycmVudFZhbHVlMjogZGVmYXVsdFZhbHVlLFxuICAgICAgICBfdGhyZWFkQ291bnQ6IDAsXG4gICAgICAgIFByb3ZpZGVyOiBudWxsLFxuICAgICAgICBDb25zdW1lcjogbnVsbFxuICAgICAgfTtcbiAgICAgIGRlZmF1bHRWYWx1ZS5Qcm92aWRlciA9IGRlZmF1bHRWYWx1ZTtcbiAgICAgIGRlZmF1bHRWYWx1ZS5Db25zdW1lciA9IHtcbiAgICAgICAgJCR0eXBlb2Y6IFJFQUNUX0NPTlNVTUVSX1RZUEUsXG4gICAgICAgIF9jb250ZXh0OiBkZWZhdWx0VmFsdWVcbiAgICAgIH07XG4gICAgICBkZWZhdWx0VmFsdWUuX2N1cnJlbnRSZW5kZXJlciA9IG51bGw7XG4gICAgICBkZWZhdWx0VmFsdWUuX2N1cnJlbnRSZW5kZXJlcjIgPSBudWxsO1xuICAgICAgcmV0dXJuIGRlZmF1bHRWYWx1ZTtcbiAgICB9O1xuICAgIGV4cG9ydHMuY3JlYXRlRWxlbWVudCA9IGZ1bmN0aW9uICh0eXBlLCBjb25maWcsIGNoaWxkcmVuKSB7XG4gICAgICBmb3IgKHZhciBpID0gMjsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKylcbiAgICAgICAgdmFsaWRhdGVDaGlsZEtleXMoYXJndW1lbnRzW2ldKTtcbiAgICAgIGkgPSB7fTtcbiAgICAgIHZhciBrZXkgPSBudWxsO1xuICAgICAgaWYgKG51bGwgIT0gY29uZmlnKVxuICAgICAgICBmb3IgKHByb3BOYW1lIGluIChkaWRXYXJuQWJvdXRPbGRKU1hSdW50aW1lIHx8XG4gICAgICAgICAgIShcIl9fc2VsZlwiIGluIGNvbmZpZykgfHxcbiAgICAgICAgICBcImtleVwiIGluIGNvbmZpZyB8fFxuICAgICAgICAgICgoZGlkV2FybkFib3V0T2xkSlNYUnVudGltZSA9ICEwKSxcbiAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICBcIllvdXIgYXBwIChvciBvbmUgb2YgaXRzIGRlcGVuZGVuY2llcykgaXMgdXNpbmcgYW4gb3V0ZGF0ZWQgSlNYIHRyYW5zZm9ybS4gVXBkYXRlIHRvIHRoZSBtb2Rlcm4gSlNYIHRyYW5zZm9ybSBmb3IgZmFzdGVyIHBlcmZvcm1hbmNlOiBodHRwczovL3JlYWN0LmRldi9saW5rL25ldy1qc3gtdHJhbnNmb3JtXCJcbiAgICAgICAgICApKSxcbiAgICAgICAgaGFzVmFsaWRLZXkoY29uZmlnKSAmJlxuICAgICAgICAgIChjaGVja0tleVN0cmluZ0NvZXJjaW9uKGNvbmZpZy5rZXkpLCAoa2V5ID0gXCJcIiArIGNvbmZpZy5rZXkpKSxcbiAgICAgICAgY29uZmlnKSlcbiAgICAgICAgICBoYXNPd25Qcm9wZXJ0eS5jYWxsKGNvbmZpZywgcHJvcE5hbWUpICYmXG4gICAgICAgICAgICBcImtleVwiICE9PSBwcm9wTmFtZSAmJlxuICAgICAgICAgICAgXCJfX3NlbGZcIiAhPT0gcHJvcE5hbWUgJiZcbiAgICAgICAgICAgIFwiX19zb3VyY2VcIiAhPT0gcHJvcE5hbWUgJiZcbiAgICAgICAgICAgIChpW3Byb3BOYW1lXSA9IGNvbmZpZ1twcm9wTmFtZV0pO1xuICAgICAgdmFyIGNoaWxkcmVuTGVuZ3RoID0gYXJndW1lbnRzLmxlbmd0aCAtIDI7XG4gICAgICBpZiAoMSA9PT0gY2hpbGRyZW5MZW5ndGgpIGkuY2hpbGRyZW4gPSBjaGlsZHJlbjtcbiAgICAgIGVsc2UgaWYgKDEgPCBjaGlsZHJlbkxlbmd0aCkge1xuICAgICAgICBmb3IgKFxuICAgICAgICAgIHZhciBjaGlsZEFycmF5ID0gQXJyYXkoY2hpbGRyZW5MZW5ndGgpLCBfaSA9IDA7XG4gICAgICAgICAgX2kgPCBjaGlsZHJlbkxlbmd0aDtcbiAgICAgICAgICBfaSsrXG4gICAgICAgIClcbiAgICAgICAgICBjaGlsZEFycmF5W19pXSA9IGFyZ3VtZW50c1tfaSArIDJdO1xuICAgICAgICBPYmplY3QuZnJlZXplICYmIE9iamVjdC5mcmVlemUoY2hpbGRBcnJheSk7XG4gICAgICAgIGkuY2hpbGRyZW4gPSBjaGlsZEFycmF5O1xuICAgICAgfVxuICAgICAgaWYgKHR5cGUgJiYgdHlwZS5kZWZhdWx0UHJvcHMpXG4gICAgICAgIGZvciAocHJvcE5hbWUgaW4gKChjaGlsZHJlbkxlbmd0aCA9IHR5cGUuZGVmYXVsdFByb3BzKSwgY2hpbGRyZW5MZW5ndGgpKVxuICAgICAgICAgIHZvaWQgMCA9PT0gaVtwcm9wTmFtZV0gJiYgKGlbcHJvcE5hbWVdID0gY2hpbGRyZW5MZW5ndGhbcHJvcE5hbWVdKTtcbiAgICAgIGtleSAmJlxuICAgICAgICBkZWZpbmVLZXlQcm9wV2FybmluZ0dldHRlcihcbiAgICAgICAgICBpLFxuICAgICAgICAgIFwiZnVuY3Rpb25cIiA9PT0gdHlwZW9mIHR5cGVcbiAgICAgICAgICAgID8gdHlwZS5kaXNwbGF5TmFtZSB8fCB0eXBlLm5hbWUgfHwgXCJVbmtub3duXCJcbiAgICAgICAgICAgIDogdHlwZVxuICAgICAgICApO1xuICAgICAgdmFyIHByb3BOYW1lID0gMWU0ID4gUmVhY3RTaGFyZWRJbnRlcm5hbHMucmVjZW50bHlDcmVhdGVkT3duZXJTdGFja3MrKztcbiAgICAgIHJldHVybiBSZWFjdEVsZW1lbnQoXG4gICAgICAgIHR5cGUsXG4gICAgICAgIGtleSxcbiAgICAgICAgaSxcbiAgICAgICAgZ2V0T3duZXIoKSxcbiAgICAgICAgcHJvcE5hbWUgPyBFcnJvcihcInJlYWN0LXN0YWNrLXRvcC1mcmFtZVwiKSA6IHVua25vd25Pd25lckRlYnVnU3RhY2ssXG4gICAgICAgIHByb3BOYW1lID8gY3JlYXRlVGFzayhnZXRUYXNrTmFtZSh0eXBlKSkgOiB1bmtub3duT3duZXJEZWJ1Z1Rhc2tcbiAgICAgICk7XG4gICAgfTtcbiAgICBleHBvcnRzLmNyZWF0ZVJlZiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciByZWZPYmplY3QgPSB7IGN1cnJlbnQ6IG51bGwgfTtcbiAgICAgIE9iamVjdC5zZWFsKHJlZk9iamVjdCk7XG4gICAgICByZXR1cm4gcmVmT2JqZWN0O1xuICAgIH07XG4gICAgZXhwb3J0cy5mb3J3YXJkUmVmID0gZnVuY3Rpb24gKHJlbmRlcikge1xuICAgICAgbnVsbCAhPSByZW5kZXIgJiYgcmVuZGVyLiQkdHlwZW9mID09PSBSRUFDVF9NRU1PX1RZUEVcbiAgICAgICAgPyBjb25zb2xlLmVycm9yKFxuICAgICAgICAgICAgXCJmb3J3YXJkUmVmIHJlcXVpcmVzIGEgcmVuZGVyIGZ1bmN0aW9uIGJ1dCByZWNlaXZlZCBhIGBtZW1vYCBjb21wb25lbnQuIEluc3RlYWQgb2YgZm9yd2FyZFJlZihtZW1vKC4uLikpLCB1c2UgbWVtbyhmb3J3YXJkUmVmKC4uLikpLlwiXG4gICAgICAgICAgKVxuICAgICAgICA6IFwiZnVuY3Rpb25cIiAhPT0gdHlwZW9mIHJlbmRlclxuICAgICAgICAgID8gY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJmb3J3YXJkUmVmIHJlcXVpcmVzIGEgcmVuZGVyIGZ1bmN0aW9uIGJ1dCB3YXMgZ2l2ZW4gJXMuXCIsXG4gICAgICAgICAgICAgIG51bGwgPT09IHJlbmRlciA/IFwibnVsbFwiIDogdHlwZW9mIHJlbmRlclxuICAgICAgICAgICAgKVxuICAgICAgICAgIDogMCAhPT0gcmVuZGVyLmxlbmd0aCAmJlxuICAgICAgICAgICAgMiAhPT0gcmVuZGVyLmxlbmd0aCAmJlxuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgXCJmb3J3YXJkUmVmIHJlbmRlciBmdW5jdGlvbnMgYWNjZXB0IGV4YWN0bHkgdHdvIHBhcmFtZXRlcnM6IHByb3BzIGFuZCByZWYuICVzXCIsXG4gICAgICAgICAgICAgIDEgPT09IHJlbmRlci5sZW5ndGhcbiAgICAgICAgICAgICAgICA/IFwiRGlkIHlvdSBmb3JnZXQgdG8gdXNlIHRoZSByZWYgcGFyYW1ldGVyP1wiXG4gICAgICAgICAgICAgICAgOiBcIkFueSBhZGRpdGlvbmFsIHBhcmFtZXRlciB3aWxsIGJlIHVuZGVmaW5lZC5cIlxuICAgICAgICAgICAgKTtcbiAgICAgIG51bGwgIT0gcmVuZGVyICYmXG4gICAgICAgIG51bGwgIT0gcmVuZGVyLmRlZmF1bHRQcm9wcyAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiZm9yd2FyZFJlZiByZW5kZXIgZnVuY3Rpb25zIGRvIG5vdCBzdXBwb3J0IGRlZmF1bHRQcm9wcy4gRGlkIHlvdSBhY2NpZGVudGFsbHkgcGFzcyBhIFJlYWN0IGNvbXBvbmVudD9cIlxuICAgICAgICApO1xuICAgICAgdmFyIGVsZW1lbnRUeXBlID0geyAkJHR5cGVvZjogUkVBQ1RfRk9SV0FSRF9SRUZfVFlQRSwgcmVuZGVyOiByZW5kZXIgfSxcbiAgICAgICAgb3duTmFtZTtcbiAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShlbGVtZW50VHlwZSwgXCJkaXNwbGF5TmFtZVwiLCB7XG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICBjb25maWd1cmFibGU6ICEwLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gb3duTmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgIG93bk5hbWUgPSBuYW1lO1xuICAgICAgICAgIHJlbmRlci5uYW1lIHx8XG4gICAgICAgICAgICByZW5kZXIuZGlzcGxheU5hbWUgfHxcbiAgICAgICAgICAgIChPYmplY3QuZGVmaW5lUHJvcGVydHkocmVuZGVyLCBcIm5hbWVcIiwgeyB2YWx1ZTogbmFtZSB9KSxcbiAgICAgICAgICAgIChyZW5kZXIuZGlzcGxheU5hbWUgPSBuYW1lKSk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIGVsZW1lbnRUeXBlO1xuICAgIH07XG4gICAgZXhwb3J0cy5pc1ZhbGlkRWxlbWVudCA9IGlzVmFsaWRFbGVtZW50O1xuICAgIGV4cG9ydHMubGF6eSA9IGZ1bmN0aW9uIChjdG9yKSB7XG4gICAgICBjdG9yID0geyBfc3RhdHVzOiAtMSwgX3Jlc3VsdDogY3RvciB9O1xuICAgICAgdmFyIGxhenlUeXBlID0ge1xuICAgICAgICAgICQkdHlwZW9mOiBSRUFDVF9MQVpZX1RZUEUsXG4gICAgICAgICAgX3BheWxvYWQ6IGN0b3IsXG4gICAgICAgICAgX2luaXQ6IGxhenlJbml0aWFsaXplclxuICAgICAgICB9LFxuICAgICAgICBpb0luZm8gPSB7XG4gICAgICAgICAgbmFtZTogXCJsYXp5XCIsXG4gICAgICAgICAgc3RhcnQ6IC0xLFxuICAgICAgICAgIGVuZDogLTEsXG4gICAgICAgICAgdmFsdWU6IG51bGwsXG4gICAgICAgICAgb3duZXI6IG51bGwsXG4gICAgICAgICAgZGVidWdTdGFjazogRXJyb3IoXCJyZWFjdC1zdGFjay10b3AtZnJhbWVcIiksXG4gICAgICAgICAgZGVidWdUYXNrOiBjb25zb2xlLmNyZWF0ZVRhc2sgPyBjb25zb2xlLmNyZWF0ZVRhc2soXCJsYXp5KClcIikgOiBudWxsXG4gICAgICAgIH07XG4gICAgICBjdG9yLl9pb0luZm8gPSBpb0luZm87XG4gICAgICBsYXp5VHlwZS5fZGVidWdJbmZvID0gW3sgYXdhaXRlZDogaW9JbmZvIH1dO1xuICAgICAgcmV0dXJuIGxhenlUeXBlO1xuICAgIH07XG4gICAgZXhwb3J0cy5tZW1vID0gZnVuY3Rpb24gKHR5cGUsIGNvbXBhcmUpIHtcbiAgICAgIG51bGwgPT0gdHlwZSAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwibWVtbzogVGhlIGZpcnN0IGFyZ3VtZW50IG11c3QgYmUgYSBjb21wb25lbnQuIEluc3RlYWQgcmVjZWl2ZWQ6ICVzXCIsXG4gICAgICAgICAgbnVsbCA9PT0gdHlwZSA/IFwibnVsbFwiIDogdHlwZW9mIHR5cGVcbiAgICAgICAgKTtcbiAgICAgIGNvbXBhcmUgPSB7XG4gICAgICAgICQkdHlwZW9mOiBSRUFDVF9NRU1PX1RZUEUsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIGNvbXBhcmU6IHZvaWQgMCA9PT0gY29tcGFyZSA/IG51bGwgOiBjb21wYXJlXG4gICAgICB9O1xuICAgICAgdmFyIG93bk5hbWU7XG4gICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkoY29tcGFyZSwgXCJkaXNwbGF5TmFtZVwiLCB7XG4gICAgICAgIGVudW1lcmFibGU6ICExLFxuICAgICAgICBjb25maWd1cmFibGU6ICEwLFxuICAgICAgICBnZXQ6IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICByZXR1cm4gb3duTmFtZTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgIG93bk5hbWUgPSBuYW1lO1xuICAgICAgICAgIHR5cGUubmFtZSB8fFxuICAgICAgICAgICAgdHlwZS5kaXNwbGF5TmFtZSB8fFxuICAgICAgICAgICAgKE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0eXBlLCBcIm5hbWVcIiwgeyB2YWx1ZTogbmFtZSB9KSxcbiAgICAgICAgICAgICh0eXBlLmRpc3BsYXlOYW1lID0gbmFtZSkpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHJldHVybiBjb21wYXJlO1xuICAgIH07XG4gICAgZXhwb3J0cy5zdGFydFRyYW5zaXRpb24gPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICAgIHZhciBwcmV2VHJhbnNpdGlvbiA9IFJlYWN0U2hhcmVkSW50ZXJuYWxzLlQsXG4gICAgICAgIGN1cnJlbnRUcmFuc2l0aW9uID0ge307XG4gICAgICBjdXJyZW50VHJhbnNpdGlvbi5fdXBkYXRlZEZpYmVycyA9IG5ldyBTZXQoKTtcbiAgICAgIFJlYWN0U2hhcmVkSW50ZXJuYWxzLlQgPSBjdXJyZW50VHJhbnNpdGlvbjtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZhciByZXR1cm5WYWx1ZSA9IHNjb3BlKCksXG4gICAgICAgICAgb25TdGFydFRyYW5zaXRpb25GaW5pc2ggPSBSZWFjdFNoYXJlZEludGVybmFscy5TO1xuICAgICAgICBudWxsICE9PSBvblN0YXJ0VHJhbnNpdGlvbkZpbmlzaCAmJlxuICAgICAgICAgIG9uU3RhcnRUcmFuc2l0aW9uRmluaXNoKGN1cnJlbnRUcmFuc2l0aW9uLCByZXR1cm5WYWx1ZSk7XG4gICAgICAgIFwib2JqZWN0XCIgPT09IHR5cGVvZiByZXR1cm5WYWx1ZSAmJlxuICAgICAgICAgIG51bGwgIT09IHJldHVyblZhbHVlICYmXG4gICAgICAgICAgXCJmdW5jdGlvblwiID09PSB0eXBlb2YgcmV0dXJuVmFsdWUudGhlbiAmJlxuICAgICAgICAgIChSZWFjdFNoYXJlZEludGVybmFscy5hc3luY1RyYW5zaXRpb25zKyssXG4gICAgICAgICAgcmV0dXJuVmFsdWUudGhlbihyZWxlYXNlQXN5bmNUcmFuc2l0aW9uLCByZWxlYXNlQXN5bmNUcmFuc2l0aW9uKSxcbiAgICAgICAgICByZXR1cm5WYWx1ZS50aGVuKG5vb3AsIHJlcG9ydEdsb2JhbEVycm9yKSk7XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICByZXBvcnRHbG9iYWxFcnJvcihlcnJvcik7XG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICBudWxsID09PSBwcmV2VHJhbnNpdGlvbiAmJlxuICAgICAgICAgIGN1cnJlbnRUcmFuc2l0aW9uLl91cGRhdGVkRmliZXJzICYmXG4gICAgICAgICAgKChzY29wZSA9IGN1cnJlbnRUcmFuc2l0aW9uLl91cGRhdGVkRmliZXJzLnNpemUpLFxuICAgICAgICAgIGN1cnJlbnRUcmFuc2l0aW9uLl91cGRhdGVkRmliZXJzLmNsZWFyKCksXG4gICAgICAgICAgMTAgPCBzY29wZSAmJlxuICAgICAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgICAgICBcIkRldGVjdGVkIGEgbGFyZ2UgbnVtYmVyIG9mIHVwZGF0ZXMgaW5zaWRlIHN0YXJ0VHJhbnNpdGlvbi4gSWYgdGhpcyBpcyBkdWUgdG8gYSBzdWJzY3JpcHRpb24gcGxlYXNlIHJlLXdyaXRlIGl0IHRvIHVzZSBSZWFjdCBwcm92aWRlZCBob29rcy4gT3RoZXJ3aXNlIGNvbmN1cnJlbnQgbW9kZSBndWFyYW50ZWVzIGFyZSBvZmYgdGhlIHRhYmxlLlwiXG4gICAgICAgICAgICApKSxcbiAgICAgICAgICBudWxsICE9PSBwcmV2VHJhbnNpdGlvbiAmJlxuICAgICAgICAgICAgbnVsbCAhPT0gY3VycmVudFRyYW5zaXRpb24udHlwZXMgJiZcbiAgICAgICAgICAgIChudWxsICE9PSBwcmV2VHJhbnNpdGlvbi50eXBlcyAmJlxuICAgICAgICAgICAgICBwcmV2VHJhbnNpdGlvbi50eXBlcyAhPT0gY3VycmVudFRyYW5zaXRpb24udHlwZXMgJiZcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcihcbiAgICAgICAgICAgICAgICBcIldlIGV4cGVjdGVkIGlubmVyIFRyYW5zaXRpb25zIHRvIGhhdmUgdHJhbnNmZXJyZWQgdGhlIG91dGVyIHR5cGVzIHNldCBhbmQgdGhhdCB5b3UgY2Fubm90IGFkZCB0byB0aGUgb3V0ZXIgVHJhbnNpdGlvbiB3aGlsZSBpbnNpZGUgdGhlIGlubmVyLlRoaXMgaXMgYSBidWcgaW4gUmVhY3QuXCJcbiAgICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIChwcmV2VHJhbnNpdGlvbi50eXBlcyA9IGN1cnJlbnRUcmFuc2l0aW9uLnR5cGVzKSksXG4gICAgICAgICAgKFJlYWN0U2hhcmVkSW50ZXJuYWxzLlQgPSBwcmV2VHJhbnNpdGlvbik7XG4gICAgICB9XG4gICAgfTtcbiAgICBleHBvcnRzLnVuc3RhYmxlX3VzZUNhY2hlUmVmcmVzaCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUNhY2hlUmVmcmVzaCgpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2UgPSBmdW5jdGlvbiAodXNhYmxlKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2UodXNhYmxlKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlQWN0aW9uU3RhdGUgPSBmdW5jdGlvbiAoYWN0aW9uLCBpbml0aWFsU3RhdGUsIHBlcm1hbGluaykge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlQWN0aW9uU3RhdGUoXG4gICAgICAgIGFjdGlvbixcbiAgICAgICAgaW5pdGlhbFN0YXRlLFxuICAgICAgICBwZXJtYWxpbmtcbiAgICAgICk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUNhbGxiYWNrID0gZnVuY3Rpb24gKGNhbGxiYWNrLCBkZXBzKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VDYWxsYmFjayhjYWxsYmFjaywgZGVwcyk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUNvbnRleHQgPSBmdW5jdGlvbiAoQ29udGV4dCkge1xuICAgICAgdmFyIGRpc3BhdGNoZXIgPSByZXNvbHZlRGlzcGF0Y2hlcigpO1xuICAgICAgQ29udGV4dC4kJHR5cGVvZiA9PT0gUkVBQ1RfQ09OU1VNRVJfVFlQRSAmJlxuICAgICAgICBjb25zb2xlLmVycm9yKFxuICAgICAgICAgIFwiQ2FsbGluZyB1c2VDb250ZXh0KENvbnRleHQuQ29uc3VtZXIpIGlzIG5vdCBzdXBwb3J0ZWQgYW5kIHdpbGwgY2F1c2UgYnVncy4gRGlkIHlvdSBtZWFuIHRvIGNhbGwgdXNlQ29udGV4dChDb250ZXh0KSBpbnN0ZWFkP1wiXG4gICAgICAgICk7XG4gICAgICByZXR1cm4gZGlzcGF0Y2hlci51c2VDb250ZXh0KENvbnRleHQpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VEZWJ1Z1ZhbHVlID0gZnVuY3Rpb24gKHZhbHVlLCBmb3JtYXR0ZXJGbikge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlRGVidWdWYWx1ZSh2YWx1ZSwgZm9ybWF0dGVyRm4pO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VEZWZlcnJlZFZhbHVlID0gZnVuY3Rpb24gKHZhbHVlLCBpbml0aWFsVmFsdWUpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZURlZmVycmVkVmFsdWUodmFsdWUsIGluaXRpYWxWYWx1ZSk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZUVmZmVjdCA9IGZ1bmN0aW9uIChjcmVhdGUsIGRlcHMpIHtcbiAgICAgIG51bGwgPT0gY3JlYXRlICYmXG4gICAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgICBcIlJlYWN0IEhvb2sgdXNlRWZmZWN0IHJlcXVpcmVzIGFuIGVmZmVjdCBjYWxsYmFjay4gRGlkIHlvdSBmb3JnZXQgdG8gcGFzcyBhIGNhbGxiYWNrIHRvIHRoZSBob29rP1wiXG4gICAgICAgICk7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VFZmZlY3QoY3JlYXRlLCBkZXBzKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlRWZmZWN0RXZlbnQgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUVmZmVjdEV2ZW50KGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlSWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VJZCgpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VJbXBlcmF0aXZlSGFuZGxlID0gZnVuY3Rpb24gKHJlZiwgY3JlYXRlLCBkZXBzKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VJbXBlcmF0aXZlSGFuZGxlKHJlZiwgY3JlYXRlLCBkZXBzKTtcbiAgICB9O1xuICAgIGV4cG9ydHMudXNlSW5zZXJ0aW9uRWZmZWN0ID0gZnVuY3Rpb24gKGNyZWF0ZSwgZGVwcykge1xuICAgICAgbnVsbCA9PSBjcmVhdGUgJiZcbiAgICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICAgIFwiUmVhY3QgSG9vayB1c2VJbnNlcnRpb25FZmZlY3QgcmVxdWlyZXMgYW4gZWZmZWN0IGNhbGxiYWNrLiBEaWQgeW91IGZvcmdldCB0byBwYXNzIGEgY2FsbGJhY2sgdG8gdGhlIGhvb2s/XCJcbiAgICAgICAgKTtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZUluc2VydGlvbkVmZmVjdChjcmVhdGUsIGRlcHMpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VMYXlvdXRFZmZlY3QgPSBmdW5jdGlvbiAoY3JlYXRlLCBkZXBzKSB7XG4gICAgICBudWxsID09IGNyZWF0ZSAmJlxuICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgXCJSZWFjdCBIb29rIHVzZUxheW91dEVmZmVjdCByZXF1aXJlcyBhbiBlZmZlY3QgY2FsbGJhY2suIERpZCB5b3UgZm9yZ2V0IHRvIHBhc3MgYSBjYWxsYmFjayB0byB0aGUgaG9vaz9cIlxuICAgICAgICApO1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlTGF5b3V0RWZmZWN0KGNyZWF0ZSwgZGVwcyk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZU1lbW8gPSBmdW5jdGlvbiAoY3JlYXRlLCBkZXBzKSB7XG4gICAgICByZXR1cm4gcmVzb2x2ZURpc3BhdGNoZXIoKS51c2VNZW1vKGNyZWF0ZSwgZGVwcyk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZU9wdGltaXN0aWMgPSBmdW5jdGlvbiAocGFzc3Rocm91Z2gsIHJlZHVjZXIpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZU9wdGltaXN0aWMocGFzc3Rocm91Z2gsIHJlZHVjZXIpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VSZWR1Y2VyID0gZnVuY3Rpb24gKHJlZHVjZXIsIGluaXRpYWxBcmcsIGluaXQpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZVJlZHVjZXIocmVkdWNlciwgaW5pdGlhbEFyZywgaW5pdCk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZVJlZiA9IGZ1bmN0aW9uIChpbml0aWFsVmFsdWUpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZVJlZihpbml0aWFsVmFsdWUpO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VTdGF0ZSA9IGZ1bmN0aW9uIChpbml0aWFsU3RhdGUpIHtcbiAgICAgIHJldHVybiByZXNvbHZlRGlzcGF0Y2hlcigpLnVzZVN0YXRlKGluaXRpYWxTdGF0ZSk7XG4gICAgfTtcbiAgICBleHBvcnRzLnVzZVN5bmNFeHRlcm5hbFN0b3JlID0gZnVuY3Rpb24gKFxuICAgICAgc3Vic2NyaWJlLFxuICAgICAgZ2V0U25hcHNob3QsXG4gICAgICBnZXRTZXJ2ZXJTbmFwc2hvdFxuICAgICkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlU3luY0V4dGVybmFsU3RvcmUoXG4gICAgICAgIHN1YnNjcmliZSxcbiAgICAgICAgZ2V0U25hcHNob3QsXG4gICAgICAgIGdldFNlcnZlclNuYXBzaG90XG4gICAgICApO1xuICAgIH07XG4gICAgZXhwb3J0cy51c2VUcmFuc2l0aW9uID0gZnVuY3Rpb24gKCkge1xuICAgICAgcmV0dXJuIHJlc29sdmVEaXNwYXRjaGVyKCkudXNlVHJhbnNpdGlvbigpO1xuICAgIH07XG4gICAgZXhwb3J0cy52ZXJzaW9uID0gXCIxOS4yLjhcIjtcbiAgICBcInVuZGVmaW5lZFwiICE9PSB0eXBlb2YgX19SRUFDVF9ERVZUT09MU19HTE9CQUxfSE9PS19fICYmXG4gICAgICBcImZ1bmN0aW9uXCIgPT09XG4gICAgICAgIHR5cGVvZiBfX1JFQUNUX0RFVlRPT0xTX0dMT0JBTF9IT09LX18ucmVnaXN0ZXJJbnRlcm5hbE1vZHVsZVN0b3AgJiZcbiAgICAgIF9fUkVBQ1RfREVWVE9PTFNfR0xPQkFMX0hPT0tfXy5yZWdpc3RlckludGVybmFsTW9kdWxlU3RvcChFcnJvcigpKTtcbiAgfSkoKTtcbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WID09PSAncHJvZHVjdGlvbicpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2Nqcy9yZWFjdC5wcm9kdWN0aW9uLmpzJyk7XG59IGVsc2Uge1xuICBtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vY2pzL3JlYWN0LmRldmVsb3BtZW50LmpzJyk7XG59XG4iLCJpbXBvcnQgUmVhY3QgZnJvbSAncmVhY3QnO1xuaW1wb3J0IHsgY3JlYXRlU3RvcmUgfSBmcm9tICd6dXN0YW5kL3ZhbmlsbGEnO1xuXG5jb25zdCBpZGVudGl0eSA9IChhcmcpID0+IGFyZztcbmZ1bmN0aW9uIHVzZVN0b3JlKGFwaSwgc2VsZWN0b3IgPSBpZGVudGl0eSkge1xuICBjb25zdCBzbGljZSA9IFJlYWN0LnVzZVN5bmNFeHRlcm5hbFN0b3JlKFxuICAgIGFwaS5zdWJzY3JpYmUsXG4gICAgUmVhY3QudXNlQ2FsbGJhY2soKCkgPT4gc2VsZWN0b3IoYXBpLmdldFN0YXRlKCkpLCBbYXBpLCBzZWxlY3Rvcl0pLFxuICAgIFJlYWN0LnVzZUNhbGxiYWNrKCgpID0+IHNlbGVjdG9yKGFwaS5nZXRJbml0aWFsU3RhdGUoKSksIFthcGksIHNlbGVjdG9yXSlcbiAgKTtcbiAgUmVhY3QudXNlRGVidWdWYWx1ZShzbGljZSk7XG4gIHJldHVybiBzbGljZTtcbn1cbmNvbnN0IGNyZWF0ZUltcGwgPSAoY3JlYXRlU3RhdGUpID0+IHtcbiAgY29uc3QgYXBpID0gY3JlYXRlU3RvcmUoY3JlYXRlU3RhdGUpO1xuICBjb25zdCB1c2VCb3VuZFN0b3JlID0gKHNlbGVjdG9yKSA9PiB1c2VTdG9yZShhcGksIHNlbGVjdG9yKTtcbiAgT2JqZWN0LmFzc2lnbih1c2VCb3VuZFN0b3JlLCBhcGkpO1xuICByZXR1cm4gdXNlQm91bmRTdG9yZTtcbn07XG5jb25zdCBjcmVhdGUgPSAoKGNyZWF0ZVN0YXRlKSA9PiBjcmVhdGVTdGF0ZSA/IGNyZWF0ZUltcGwoY3JlYXRlU3RhdGUpIDogY3JlYXRlSW1wbCk7XG5cbmV4cG9ydCB7IGNyZWF0ZSwgdXNlU3RvcmUgfTtcbiIsIi8qKlxuICog6YWN572u57G75Z6L5a6a5LmJ5LiO6buY6K6k5YC8XG4gKiAxOjEg6L+Y5Y6f5Y6fIGpzL2luaXQuanMg55qEIEcuT3B0aW9uTGlzdHMgLyBHLkxvY2FsVmFyIC8gRy5zY3JpcHRMaXN0IC8gRy5mZm1wZWdDb25maWdcbiAqL1xuXG4vLyA9PT09PSDmk43kvZznrKYgPT09PT1cbmV4cG9ydCB0eXBlIE9wZXJhdG9yID0gJz0nIHwgJzwnIHwgJz4nIHwgJzw9JyB8ICc+PScgfCAnIT0nIHwgJ34nO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV4dFJ1bGUge1xuICBleHQ6IHN0cmluZztcbiAgc2l6ZTogbnVtYmVyO1xuICBvcGVyYXRvcjogT3BlcmF0b3I7XG4gIHVuaXQ6ICdCJyB8ICdCWVRFJyB8ICdLQicgfCAnTUInIHwgJ0dCJztcbiAgc3RhdGU6IGJvb2xlYW47XG4gIC8qKiBvcGVyYXRvciA9PT0gJ34nIOaXtuaLhuWHuueahCBtaW4vbWF4KOi/kOihjOaXtuiuoeeulyzkuI3lhaUgc3RvcmFnZSkgKi9cbiAgbWluPzogbnVtYmVyO1xuICBtYXg/OiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgVHlwZVJ1bGUgZXh0ZW5kcyBPbWl0PEV4dFJ1bGUsICdleHQnPiB7XG4gIHR5cGU6IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBSZWdleFJ1bGUge1xuICB0eXBlOiAnaScgfCAnaWcnIHwgJ2cnIHwgJ2dpJztcbiAgcmVnZXg6IHN0cmluZztcbiAgZXh0OiBzdHJpbmc7XG4gIGJsYWNrTGlzdD86IGJvb2xlYW47XG4gIHN0YXRlOiBib29sZWFuO1xufVxuXG4vKiog6aKE57yW6K+R5ZCO55qEIFJlZ2V4IOmhuSjov5DooYzml7blvaLmgIEpICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVkUmVnZXhSdWxlIHtcbiAgcmVnZXg6IFJlZ0V4cDtcbiAgZXh0OiBzdHJpbmc7XG4gIGJsYWNrTGlzdDogYm9vbGVhbjtcbiAgc3RhdGU6IGJvb2xlYW47XG59XG5cbi8qKiDpgJrphY3nrKblsY/olL0gVVJMIOinhOWImShzdG9yYWdlIOW9ouaAgSkgKi9cbmV4cG9ydCBpbnRlcmZhY2UgQmxvY2tVcmxSdWxlUmF3IHtcbiAgdXJsOiBzdHJpbmc7XG4gIHN0YXRlOiBib29sZWFuO1xufVxuXG4vKiog6aKE57yW6K+R5ZCO55qE6YCa6YWN56ym6KeE5YiZICovXG5leHBvcnQgaW50ZXJmYWNlIENvbXBpbGVkQmxvY2tVcmxSdWxlIHtcbiAgdXJsOiBSZWdFeHA7XG4gIHN0YXRlOiBib29sZWFuO1xufVxuXG4vLyA9PT09PSDpu5jorqTmianlsZXlkI3op4TliJko5Y6fIGluaXQuanMg56ysIDI5LTYyIOihjCkgPT09PT1cbmV4cG9ydCBjb25zdCBERUZBVUxUX0VYVF9SVUxFUzogRXh0UnVsZVtdID0gW1xuICAnZmx2JywgJ2hsdicsICdmNHYnLCAnbXA0JywgJ21wMycsICd3bWEnLCAnd2F2JywgJ200YScsXG4gICd0cycsICd3ZWJtJywgJ29nZycsICdvZ3YnLCAnYWNjJywgJ21vdicsICdta3YnLCAnbTRzJyxcbiAgJ20zdTgnLCAnbTN1JywgJ21wZWcnLCAnYXZpJywgJ3dtdicsICdhc2YnLCAnbW92aWUnLCAnZGl2eCcsXG4gICdtcGVnNCcsICd2aWQnLCAnYWFjJywgJ21wZCcsICd3ZWJhJywgJ29wdXMnLCAnc3J0JywgJ3Z0dCcsXG5dLm1hcCgoZXh0KSA9PiAoe1xuICBleHQsXG4gIHNpemU6IDAsXG4gIG9wZXJhdG9yOiAnPj0nIGFzIE9wZXJhdG9yLFxuICB1bml0OiAnS0InIGFzIGNvbnN0LFxuICBzdGF0ZTogIVsndHMnLCAnc3J0JywgJ3Z0dCddLmluY2x1ZGVzKGV4dCksXG59KSk7XG5cbi8vID09PT09IOm7mOiupCBUeXBlIOinhOWImSjljp8gaW5pdC5qcyDnrKwgNjMtNzMg6KGMKSA9PT09PVxuZXhwb3J0IGNvbnN0IERFRkFVTFRfVFlQRV9SVUxFUzogVHlwZVJ1bGVbXSA9IFtcbiAgJ2F1ZGlvLyonLCAndmlkZW8vKicsXG4gICdhcHBsaWNhdGlvbi9vZ2cnLFxuICAnYXBwbGljYXRpb24vdm5kLmFwcGxlLm1wZWd1cmwnLFxuICAnYXBwbGljYXRpb24veC1tcGVndXJsJyxcbiAgJ2FwcGxpY2F0aW9uL21wZWd1cmwnLFxuICAnYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtLW0zdTgnLFxuICAnYXBwbGljYXRpb24vZGFzaCt4bWwnLFxuICAnYXBwbGljYXRpb24vbTRzJyxcbl0ubWFwKCh0eXBlKSA9PiAoe1xuICB0eXBlLFxuICBzaXplOiAwLFxuICBvcGVyYXRvcjogJz49JyBhcyBPcGVyYXRvcixcbiAgdW5pdDogJ0tCJyBhcyBjb25zdCxcbiAgc3RhdGU6IHRydWUsXG59KSk7XG5cbi8vID09PT09IOm7mOiupCBSZWdleCDop4TliJko5Y6fIGluaXQuanMg56ysIDc0LTc5IOihjCkgPT09PT1cbmV4cG9ydCBjb25zdCBERUZBVUxUX1JFR0VYX1JVTEVTOiBSZWdleFJ1bGVbXSA9IFtcbiAgeyB0eXBlOiAnaWcnLCByZWdleDogJ2h0dHBzOi8vY2FjaGVcXFxcLnZpZGVvXFxcXC5bYS16XSpcXFxcLmNvbS9kYXNoXFxcXD90dmlkPS4qJywgZXh0OiAnanNvbicsIHN0YXRlOiBmYWxzZSB9LFxuICB7IHR5cGU6ICdpZycsIHJlZ2V4OiAnLipcXFxcLmJpbGl2aWRlb1xcXFwuKGNvbXxjbikuKlxcXFwvbGl2ZS1idmNcXFxcLy4qbTRzJywgZXh0OiAnJywgYmxhY2tMaXN0OiB0cnVlLCBzdGF0ZTogZmFsc2UgfSxcbiAgeyB0eXBlOiAnaWcnLCByZWdleDogJyheaHR0cHM6Ly9zY29udGVudFthLXowLTktXSpcXFxcLmNkbmluc3RhZ3JhbVxcXFwuY29tLy4qKSZieXRlc3RhcnQ9LionLCBleHQ6ICcnLCBibGFja0xpc3Q6IGZhbHNlLCBzdGF0ZTogZmFsc2UgfSxcbiAgeyB0eXBlOiAnaWcnLCByZWdleDogJyheaHR0cHM6Ly8uKlxcXFwuZmJjZG5cXFxcLm5ldC8uKikmYnl0ZXN0YXJ0PS4qJywgZXh0OiAnJywgYmxhY2tMaXN0OiBmYWxzZSwgc3RhdGU6IGZhbHNlIH0sXG5dO1xuXG4vLyA9PT09PSDpgb/lhY3mipPlj5bliJfooago5Y6fIEcuZGFtblVybCkgPT09PT1cbmV4cG9ydCBjb25zdCBERUZBVUxUX0RBTU5fVVJMX1BBVFRFUk5TOiBSZWdFeHBbXSA9IFtcbiAgL15odHRwczpcXC9cXC8uKlxcLmRvdXlpblxcLmNvbVxcLy4qJC9pLFxuXTtcblxuLy8gPT09PT0gT3B0aW9uTGlzdHMg5qCH6YeP6buY6K6k5YC8KOWOnyBpbml0LmpzIOesrCA4MC0xNzYg6KGMKSA9PT09PVxuZXhwb3J0IGNvbnN0IERFRkFVTFRfT1BUSU9OUyA9IHtcbiAgVGl0bGVOYW1lOiBmYWxzZSBhcyBib29sZWFuIHwgc3RyaW5nLFxuICBQbGF5ZXI6ICcnLFxuICBTaG93V2ViSWNvOiB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAhL01vYmlsZXxBbmRyb2lkfGlQaG9uZXxpUGFkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSxcbiAgTW9iaWxlVXNlckFnZW50OiAnTW96aWxsYS81LjAgKGlQaG9uZTsgQ1BVIGlQaG9uZSBPUyAxOF82IGxpa2UgTWFjIE9TIFgpIEFwcGxlV2ViS2l0LzYwNS4xLjE1IChLSFRNTCwgbGlrZSBHZWNrbykgTW9iaWxlLzE1RTE0OCcsXG5cbiAgLy8gbTN1OGRsIOWNj+iurlxuICBtM3U4ZGw6IDAgYXMgMCB8IDEgfCAyLFxuICBtM3U4ZGxBcmc6ICdcIiR7dXJsfVwiIC0tc2F2ZS1kaXIgXCIlVVNFUlBST0ZJTEUlXFxcXERvd25sb2Fkc1xcXFxtM3U4ZGxcIiAtLXNhdmUtbmFtZSBcIiR7dGl0bGV9XyR7bm93fVwiICR7cmVmZXJlcnxleGlzdHM6XFwnLUggXCJSZWZlcmVyOipcIlxcJ30gJHtjb29raWV8ZXhpc3RzOlxcJy1IIFwiQ29va2llOipcIlxcJ30gLS1uby1sb2cnLFxuICBtM3U4ZGxDb25maXJtOiBmYWxzZSxcblxuICBwbGF5YmFja1JhdGU6IDIsXG5cbiAgY29weU0zVTg6ICcke3VybH0nLFxuICBjb3B5TVBEOiAnJHt1cmx9JyxcbiAgY29weU90aGVyOiAnJHt1cmx9JyxcblxuICBhdXRvQ2xlYXJNb2RlOiAxIGFzIDAgfCAxIHwgMixcbiAgY2F0RG93bmxvYWQ6IGZhbHNlLFxuICBzYXZlQXM6IGZhbHNlLFxuICB1c2VyQWdlbnQ6ICcnLFxuICBkb3duRmlsZU5hbWU6ICcke3RpdGxlfS4ke2V4dH0nLFxuICBjc3M6ICcnLFxuICBjaGVja0R1cGxpY2F0ZXM6IHRydWUsXG4gIGVuYWJsZTogdHJ1ZSBhcyBib29sZWFuLFxuICBkb3duQWN0aXZlOiB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAhL01vYmlsZXxBbmRyb2lkfGlQaG9uZXxpUGFkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KSxcbiAgZG93bkF1dG9DbG9zZTogdHJ1ZSxcbiAgZG93blN0cmVhbTogZmFsc2UsXG5cbiAgLy8gQXJpYTJcbiAgYXJpYTJScGM6ICdodHRwOi8vbG9jYWxob3N0OjY4MDAvanNvbnJwYycsXG4gIGVuYWJsZUFyaWEyUnBjOiBmYWxzZSxcbiAgZW5hYmxlQXJpYTJScGNSZWZlcmVyOiB0cnVlLFxuICBhcmlhMlJwY1Rva2VuOiAnJyxcbiAgYXJpYTJScGNEaXI6ICcnLFxuXG4gIG0zdThBdXRvRG93bjogdHJ1ZSxcbiAgYmFkZ2VOdW1iZXI6IHRydWUsXG5cbiAgLy8g5Y+R6YCB5Yiw5pys5ZywXG4gIHNlbmQybG9jYWw6IGZhbHNlLFxuICBzZW5kMmxvY2FsTWFudWFsOiBmYWxzZSxcbiAgc2VuZDJsb2NhbFVSTDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODAwMC8nLFxuICBzZW5kMmxvY2FsTWV0aG9kOiAnUE9TVCcgYXMgJ1BPU1QnIHwgJ0dFVCcsXG4gIHNlbmQybG9jYWxCb2R5OiAne1wiYWN0aW9uXCI6IFwiJHthY3Rpb259XCIsIFwiZGF0YVwiOiAke2RhdGF9LCBcInRhYklkXCI6IFwiJHt0YWJJZH1cIn0nLFxuICBzZW5kMmxvY2FsVHlwZTogMCBhcyAwIHwgMSB8IDIgfCAzLFxuICBzZW5kMmxvY2FsSGVhZGVyczogJycsXG5cbiAgcG9wdXA6IGZhbHNlLFxuICBwb3B1cE1vZGU6IDAgYXMgMCB8IDEgfCAyIHwgMyxcblxuICAvLyDov5znqIvosIPnlKhcbiAgaW52b2tlOiBmYWxzZSxcbiAgaW52b2tlVGV4dDogJ20zdThkbHJlOlwiJHt1cmx9XCIgLS1zYXZlLWRpciBcIiVVU0VSUFJPRklMRSVcXFxcRG93bmxvYWRzXCIgLS1kZWwtYWZ0ZXItZG9uZSAtLXNhdmUtbmFtZSBcIiR7dGl0bGV9XyR7bm93fVwiIC0tYXV0by1zZWxlY3QgJHtyZWZlcmVyfGV4aXN0czpcXCctSCBcIlJlZmVyZXI6ICpcIlxcJ30nLFxuICBpbnZva2VDb25maXJtOiBmYWxzZSxcblxuICAvLyBtM3U4IOino+aekOWZqOm7mOiupOWPguaVsFxuICBNM3U4VGhyZWFkOiA2LFxuICBNM3U4TXA0OiBmYWxzZSxcbiAgTTN1OE9ubHlBdWRpbzogZmFsc2UsXG4gIE0zdThTa2lwRGVjcnlwdDogZmFsc2UsXG4gIE0zdThTdHJlYW1TYXZlcjogZmFsc2UsXG4gIE0zdThGZm1wZWc6IHRydWUsXG4gIE0zdThBdXRvQ2xvc2U6IGZhbHNlLFxuXG4gIG9ubGluZVNlcnZpY2VBZGRyZXNzOiAwIGFzIDAgfCAxLFxuICBjaHJvbWVMaW1pdFNpemU6IDEuOCAqIDEwMjQgKiAxMDI0ICogMTAyNCxcbiAgYmxvY2tVcmw6IFtdIGFzIEJsb2NrVXJsUnVsZVJhd1tdLFxuICBibG9ja1VybFdoaXRlOiBmYWxzZSxcbiAgbWF4TGVuZ3RoOiB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJiAvTW9iaWxlfEFuZHJvaWR8aVBob25lfGlQYWQvaS50ZXN0KG5hdmlnYXRvci51c2VyQWdlbnQpID8gOTk5IDogOTk5OSxcbiAgc2lkZVBhbmVsOiBmYWxzZSxcbiAgZGVlcFNlYXJjaDogZmFsc2UsXG5cbiAgLy8gTVFUVFxuICBzZW5kMk1RVFQ6IGZhbHNlLFxuICBtcXR0RW5hYmxlOiBmYWxzZSxcbiAgbXF0dEJyb2tlcjogJ3Rlc3QubW9zcXVpdHRvLm9yZycsXG4gIG1xdHRQb3J0OiA4MDgxLFxuICBtcXR0UGF0aDogJy9tcXR0JyxcbiAgbXF0dFByb3RvY29sOiAnd3NzJyBhcyAnd3NzJyB8ICd3cycsXG4gIG1xdHRDbGllbnRJZDogJ2NhdC1jYXRjaC1jbGllbnQnLFxuICBtcXR0VXNlcjogJycsXG4gIG1xdHRQYXNzd29yZDogJycsXG4gIG1xdHRUb3BpYzogJ2NhdC1jYXRjaC9tZWRpYScsXG4gIG1xdHRRb3M6IDAsXG4gIG1xdHRUaXRsZUxlbmd0aDogMTAwLFxuICBtcXR0RGF0YUZvcm1hdDogJycsXG5cbiAgZ2V0SHRtbERPTTogZmFsc2UsXG4gIGRhbW46IGZhbHNlLFxuICBpZnJhbWVGRm1wZWc6IGZhbHNlLFxuICBjb250ZXh0TWVudXM6IGZhbHNlLFxuICByZXZlcnNlOiBmYWxzZSxcbn07XG5cbi8vID09PT09IExvY2FsVmFyIOm7mOiupOWAvCjljp8gaW5pdC5qcyDnrKwgMTc5LTE4OSDooYwpID09PT09XG5leHBvcnQgY29uc3QgREVGQVVMVF9MT0NBTF9WQVIgPSB7XG4gIGZlYXRNb2JpbGVUYWJJZDogW10gYXMgbnVtYmVyW10sXG4gIGZlYXRBdXRvRG93blRhYklkOiBbXSBhcyBudW1iZXJbXSxcbiAgbWVkaWFDb250cm9sOiB7IHRhYmlkOiAwLCBpbmRleDogLTEgfSxcbiAgcHJldmlld1Nob3dUaXRsZTogZmFsc2UsXG4gIHByZXZpZXdEZWxldGVEdXBsaWNhdGVGaWxlbmFtZXM6IGZhbHNlLFxuICBNM3U4SGlkZURvd25sb2FkZWRTZWdtZW50czogdHJ1ZSxcbn07XG5cbi8vID09PT09IOiEmuacrOWIl+ihqCjljp8gaW5pdC5qcyDnrKwgMTk3LTIwMiDooYwpID09PT09XG5leHBvcnQgaW50ZXJmYWNlIFNjcmlwdEVudHJ5IHtcbiAga2V5OiBzdHJpbmc7XG4gIHJlZnJlc2g6IGJvb2xlYW47XG4gIGFsbEZyYW1lczogYm9vbGVhbjtcbiAgd29ybGQ6ICdNQUlOJyB8ICdJU09MQVRFRCc7XG4gIG5hbWU6IHN0cmluZztcbiAgb2ZmOiBzdHJpbmc7XG4gIGkxOG46IGJvb2xlYW47XG4gIHRhYklkOiBTZXQ8bnVtYmVyPjtcbn1cblxuZXhwb3J0IGNvbnN0IERFRkFVTFRfU0NSSVBUX0xJU1Q6IEFycmF5PFtzdHJpbmcsIE9taXQ8U2NyaXB0RW50cnksICd0YWJJZCc+XT4gPSBbXG4gIFsnc2VhcmNoLmpzJywgeyBrZXk6ICdzZWFyY2gnLCByZWZyZXNoOiB0cnVlLCBhbGxGcmFtZXM6IHRydWUsIHdvcmxkOiAnTUFJTicsIG5hbWU6ICdkZWVwU2VhcmNoJywgb2ZmOiAnY2xvc2VTZWFyY2gnLCBpMThuOiBmYWxzZSB9XSxcbiAgWydjYXRjaC5qcycsIHsga2V5OiAnY2F0Y2gnLCByZWZyZXNoOiB0cnVlLCBhbGxGcmFtZXM6IHRydWUsIHdvcmxkOiAnTUFJTicsIG5hbWU6ICdjYWNoZUNhcHR1cmUnLCBvZmY6ICdjbG9zZUNhcHR1cmUnLCBpMThuOiB0cnVlIH1dLFxuICBbJ3JlY29yZGVyLmpzJywgeyBrZXk6ICdyZWNvcmRlcicsIHJlZnJlc2g6IGZhbHNlLCBhbGxGcmFtZXM6IHRydWUsIHdvcmxkOiAnTUFJTicsIG5hbWU6ICd2aWRlb1JlY29yZGluZycsIG9mZjogJ2Nsb3NlUmVjb3JkaW5nJywgaTE4bjogdHJ1ZSB9XSxcbiAgWydyZWNvcmRlcjIuanMnLCB7IGtleTogJ3JlY29yZGVyMicsIHJlZnJlc2g6IGZhbHNlLCBhbGxGcmFtZXM6IGZhbHNlLCB3b3JsZDogJ01BSU4nLCBuYW1lOiAnc2NyZWVuQ2FwdHVyZScsIG9mZjogJ2Nsb3NlQ2FwdHVyZScsIGkxOG46IHRydWUgfV0sXG4gIFsnd2VicnRjLmpzJywgeyBrZXk6ICd3ZWJydGMnLCByZWZyZXNoOiB0cnVlLCBhbGxGcmFtZXM6IHRydWUsIHdvcmxkOiAnTUFJTicsIG5hbWU6ICdyZWNvcmRXZWJSVEMnLCBvZmY6ICdjbG9zZVJlY29yZGluZycsIGkxOG46IHRydWUgfV0sXG5dO1xuXG4vLyA9PT09PSBmZm1wZWcg6YWN572uKOWOnyBpbml0LmpzIOesrCAyMDUtMjEyIOihjCkgPT09PT1cbmV4cG9ydCBpbnRlcmZhY2UgRmZtcGVnQ29uZmlnIHtcbiAgdGFiOiBudW1iZXI7XG4gIGNhY2hlRGF0YTogdW5rbm93bltdO1xuICB2ZXJzaW9uOiBudW1iZXI7XG4gIHVybDogc3RyaW5nO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlRmZtcGVnQ29uZmlnKG9ubGluZVNlcnZpY2VBZGRyZXNzOiAwIHwgMSA9IDApOiBGZm1wZWdDb25maWcge1xuICByZXR1cm4ge1xuICAgIHRhYjogMCxcbiAgICBjYWNoZURhdGE6IFtdLFxuICAgIHZlcnNpb246IDEsXG4gICAgdXJsOiBvbmxpbmVTZXJ2aWNlQWRkcmVzcyA9PT0gMCA/ICdodHRwczovL2ZmbXBlZy5ibW1tZC5jb20vJyA6ICdodHRwczovL2ZmbXBlZy45NGNhdC5jb20vJyxcbiAgfTtcbn1cblxuLy8gPT09PT0gc3RyZWFtU2F2ZXIg6YWN572uID09PT09XG5leHBvcnQgZnVuY3Rpb24gZ2V0U3RyZWFtU2F2ZXJVcmwob25saW5lU2VydmljZUFkZHJlc3M6IDAgfCAxID0gMCk6IHN0cmluZyB7XG4gIHJldHVybiBvbmxpbmVTZXJ2aWNlQWRkcmVzcyA9PT0gMFxuICAgID8gJ2h0dHBzOi8vc3RyZWFtLmJtbW1kLmNvbS9taXRtLmh0bWwnXG4gICAgOiAnaHR0cHM6Ly9mZm1wZWcuOTRjYXQuY29tL21pdG0uaHRtbCc7XG59XG4iLCJpbXBvcnQgeyBjcmVhdGUgfSBmcm9tICd6dXN0YW5kJztcbmltcG9ydCB0eXBlIHtcbiAgRXh0UnVsZSxcbiAgVHlwZVJ1bGUsXG4gIFJlZ2V4UnVsZSxcbiAgQ29tcGlsZWRSZWdleFJ1bGUsXG4gIEJsb2NrVXJsUnVsZVJhdyxcbiAgQ29tcGlsZWRCbG9ja1VybFJ1bGUsXG4gIFNjcmlwdEVudHJ5LFxuICBGZm1wZWdDb25maWcsXG4gIE9wZXJhdG9yLFxufSBmcm9tICdAbGliL2NvbmZpZyc7XG5pbXBvcnQge1xuICBERUZBVUxUX0VYVF9SVUxFUyxcbiAgREVGQVVMVF9UWVBFX1JVTEVTLFxuICBERUZBVUxUX1JFR0VYX1JVTEVTLFxuICBERUZBVUxUX0RBTU5fVVJMX1BBVFRFUk5TLFxuICBERUZBVUxUX09QVElPTlMsXG4gIERFRkFVTFRfTE9DQUxfVkFSLFxuICBERUZBVUxUX1NDUklQVF9MSVNULFxuICBjcmVhdGVGZm1wZWdDb25maWcsXG59IGZyb20gJ0BsaWIvY29uZmlnJztcblxuLyoqXG4gKiDlt6Xlhbc65oqKIEFycmF5PHtleHR8dHlwZSwgLi4ufT4g6L2s5Li6IE1hcCzlubbop6PmnpAgJ34nIOaTjeS9nOespueahCBtaW4vbWF4XG4gKiDov5jljp/ljp8gaW5pdC5qcyDnrKwgMjQ5LTI2NyDooYznmoQgaXRlbXMuRXh0ID0gbmV3IE1hcChpdGVtcy5FeHQubWFwKC4uLikpXG4gKi9cbmZ1bmN0aW9uIHRvRXh0TWFwKHJ1bGVzOiBFeHRSdWxlW10pOiBNYXA8c3RyaW5nLCBFeHRSdWxlPiB7XG4gIHJldHVybiBuZXcgTWFwKFxuICAgIHJ1bGVzLm1hcCgoaXRlbSkgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IHsgLi4uaXRlbSB9O1xuICAgICAgaWYgKG5leHQub3BlcmF0b3IgPT09IHVuZGVmaW5lZCkgbmV4dC5vcGVyYXRvciA9ICc+PScgYXMgT3BlcmF0b3I7XG4gICAgICBpZiAobmV4dC5vcGVyYXRvciA9PT0gJ34nKSB7XG4gICAgICAgIGNvbnN0IFttaW4sIG1heF0gPSBTdHJpbmcobmV4dC5zaXplKS5zcGxpdCgnLScpO1xuICAgICAgICBuZXh0Lm1pbiA9IG1pbiA/IHBhcnNlSW50KG1pbiwgMTApIDogMDtcbiAgICAgICAgbmV4dC5tYXggPSBtYXggPyBwYXJzZUludChtYXgsIDEwKSA6IDA7XG4gICAgICB9XG4gICAgICByZXR1cm4gW2l0ZW0uZXh0LCBuZXh0XTtcbiAgICB9KSxcbiAgKTtcbn1cblxuZnVuY3Rpb24gdG9UeXBlTWFwKHJ1bGVzOiBUeXBlUnVsZVtdKTogTWFwPHN0cmluZywgVHlwZVJ1bGU+IHtcbiAgcmV0dXJuIG5ldyBNYXAoXG4gICAgcnVsZXMubWFwKChpdGVtKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0geyAuLi5pdGVtIH07XG4gICAgICBpZiAobmV4dC5vcGVyYXRvciA9PT0gdW5kZWZpbmVkKSBuZXh0Lm9wZXJhdG9yID0gJz49JyBhcyBPcGVyYXRvcjtcbiAgICAgIGlmIChuZXh0Lm9wZXJhdG9yID09PSAnficpIHtcbiAgICAgICAgY29uc3QgW21pbiwgbWF4XSA9IFN0cmluZyhuZXh0LnNpemUpLnNwbGl0KCctJyk7XG4gICAgICAgIG5leHQubWluID0gbWluID8gcGFyc2VJbnQobWluLCAxMCkgOiAwO1xuICAgICAgICBuZXh0Lm1heCA9IG1heCA/IHBhcnNlSW50KG1heCwgMTApIDogMDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBbaXRlbS50eXBlLCBuZXh0XTtcbiAgICB9KSxcbiAgKTtcbn1cblxuLyoqIOmihOe8luivkSBSZWdleCDmlbDnu4Qo6L+Y5Y6fIGluaXQuanMg56ysIDI2OS0yNzMg6KGMKSAqL1xuZnVuY3Rpb24gY29tcGlsZVJlZ2V4KHJ1bGVzOiBSZWdleFJ1bGVbXSk6IENvbXBpbGVkUmVnZXhSdWxlW10ge1xuICByZXR1cm4gcnVsZXMubWFwKChpdGVtKSA9PiB7XG4gICAgbGV0IHJlZ2V4OiBSZWdFeHAgfCB1bmRlZmluZWQ7XG4gICAgdHJ5IHtcbiAgICAgIHJlZ2V4ID0gbmV3IFJlZ0V4cChpdGVtLnJlZ2V4LCBpdGVtLnR5cGUpO1xuICAgIH0gY2F0Y2gge1xuICAgICAgcmV0dXJuIHsgcmVnZXg6IC8oPzopLywgZXh0OiBpdGVtLmV4dCwgYmxhY2tMaXN0OiAhIWl0ZW0uYmxhY2tMaXN0LCBzdGF0ZTogZmFsc2UgfTtcbiAgICB9XG4gICAgcmV0dXJuIHsgcmVnZXgsIGV4dDogaXRlbS5leHQsIGJsYWNrTGlzdDogISFpdGVtLmJsYWNrTGlzdCwgc3RhdGU6IGl0ZW0uc3RhdGUgfTtcbiAgfSk7XG59XG5cbi8qKiDpooTnvJbor5EgYmxvY2tVcmwg6YCa6YWN56ymKOi/mOWOnyBpbml0LmpzIOesrCAyNzUtMjc3IOihjCkgKi9cbmZ1bmN0aW9uIGNvbXBpbGVCbG9ja1VybChydWxlczogQmxvY2tVcmxSdWxlUmF3W10pOiBDb21waWxlZEJsb2NrVXJsUnVsZVtdIHtcbiAgcmV0dXJuIHJ1bGVzLm1hcCgoaXRlbSkgPT4gKHtcbiAgICB1cmw6IHdpbGRjYXJkVG9SZWdleChpdGVtLnVybCksXG4gICAgc3RhdGU6IGl0ZW0uc3RhdGUsXG4gIH0pKTtcbn1cblxuLyoqIOmAmumFjeespiAtPiBSZWdFeHAo6L+Y5Y6fIGluaXQuanMg56ysIDQzOS00NDkg6KGMKSAqL1xuZnVuY3Rpb24gd2lsZGNhcmRUb1JlZ2V4KHVybFBhdHRlcm46IHN0cmluZyk6IFJlZ0V4cCB7XG4gIGNvbnN0IHJlZ2V4UGF0dGVybiA9IHVybFBhdHRlcm5cbiAgICAucmVwbGFjZSgvWy4rXiR7fSgpfFtcXF1cXFxcXS9nLCAnXFxcXCQmJylcbiAgICAucmVwbGFjZSgvXFwqL2csICcuKicpXG4gICAgLnJlcGxhY2UoL1xcPy9nLCAnLicpO1xuICByZXR1cm4gbmV3IFJlZ0V4cChgXiR7cmVnZXhQYXR0ZXJufSRgLCAnaScpO1xufVxuXG4vKipcbiAqIFNldHRpbmdzIFN0b3JlIOKAlOKAlCDlrozmlbTov5jljp/ljp/pobnnm67lhajlsYDlr7nosaEgR1xuICogLSDlkK/liqjml7bku44gY2hyb21lLnN0b3JhZ2Uuc3luYyDor7vlj5bphY3nva5cbiAqIC0g55uR5ZCsIGNocm9tZS5zdG9yYWdlLm9uQ2hhbmdlZCDoh6rliqjlkIzmraVcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBTZXR0aW5nc1N0YXRlIHtcbiAgLy8gPT09IOi/kOihjOaXtuWIneWni+WMluagh+W/lyA9PT1cbiAgaW5pdFN5bmNDb21wbGV0ZTogYm9vbGVhbjtcbiAgaW5pdExvY2FsQ29tcGxldGU6IGJvb2xlYW47XG5cbiAgLy8gPT09IOW5s+WPsCA9PT1cbiAgdGFiSWQ6IG51bWJlcjsgLy8g5b2T5YmN5rS75YqoIHRhYijljp8gRy50YWJJZClcbiAgaXNNb2JpbGU6IGJvb2xlYW47IC8vIOWOnyBHLmlzTW9iaWxlXG4gIGlzRmlyZWZveDogYm9vbGVhbjsgLy8g5Y6fIEcuaXNGaXJlZm94XG4gIHZlcnNpb246IG51bWJlcjsgLy8g5Y6fIEcudmVyc2lvbihDaHJvbWUg5Li754mI5pys5Y+3KVxuXG4gIC8vID09PSBPcHRpb25MaXN0cyAtIOmbhuWQiOexu+WeiyA9PT1cbiAgRXh0OiBNYXA8c3RyaW5nLCBFeHRSdWxlPjsgLy8g5rOo5oSPOuaYryBNYXAs5LiN5pivIEFycmF5XG4gIFR5cGU6IE1hcDxzdHJpbmcsIFR5cGVSdWxlPjtcbiAgUmVnZXg6IENvbXBpbGVkUmVnZXhSdWxlW107XG4gIGJsb2NrVXJsOiBDb21waWxlZEJsb2NrVXJsUnVsZVtdO1xuXG4gIC8vID09PSBPcHRpb25MaXN0cyAtIOagh+mHjyjlkIzmraXliLAgY2hyb21lLnN0b3JhZ2Uuc3luYykgPT09XG4gIG9wdGlvbnM6IHR5cGVvZiBERUZBVUxUX09QVElPTlM7XG5cbiAgLy8gPT09IExvY2FsVmFyKOWQjOatpeWIsCBjaHJvbWUuc3RvcmFnZS5sb2NhbCAvIHNlc3Npb24pID09PVxuICBmZWF0TW9iaWxlVGFiSWQ6IFNldDxudW1iZXI+O1xuICBmZWF0QXV0b0Rvd25UYWJJZDogU2V0PG51bWJlcj47XG4gIG1lZGlhQ29udHJvbDogeyB0YWJpZDogbnVtYmVyOyBpbmRleDogbnVtYmVyIH07XG4gIHByZXZpZXdTaG93VGl0bGU6IGJvb2xlYW47XG4gIHByZXZpZXdEZWxldGVEdXBsaWNhdGVGaWxlbmFtZXM6IGJvb2xlYW47XG4gIE0zdThIaWRlRG93bmxvYWRlZFNlZ21lbnRzOiBib29sZWFuO1xuXG4gIC8vID09PSDov5DooYzml7bpm4blkIggPT09XG4gIGVuYWJsZTogYm9vbGVhbjsgLy8g5Y6fIEcuZW5hYmxlLOS4jiBvcHRpb25zLmVuYWJsZSDlkIzmraVcbiAgZGFtblVybDogUmVnRXhwW107IC8vIOehrOe8lueggemBv+WFjeaKk+WPluWIl+ihqCjljp8gRy5kYW1uVXJsKVxuICBkYW1uVXJsU2V0OiBTZXQ8bnVtYmVyPjsgLy8gdGFiSWQg57qn5Yir6YG/5YWN5oqT5Y+WKOWOnyBHLmRhbW5VcmxTZXQpXG4gIGJsb2NrVXJsU2V0OiBTZXQ8bnVtYmVyPjsgLy8gdGFiSWQg57qn5Yir5bGP6JS9KOWOnyBHLmJsb2NrVXJsU2V0KVxuICBibG9ja1VybFdoaXRlOiBib29sZWFuOyAvLyDnmb3lkI3ljZXmqKHlvI8o5Y6fIEcuYmxvY2tVcmxXaGl0ZSlcbiAgc2NyaXB0TGlzdDogTWFwPHN0cmluZywgU2NyaXB0RW50cnk+OyAvLyDljp8gRy5zY3JpcHRMaXN0XG4gIGZmbXBlZ0NvbmZpZzogRmZtcGVnQ29uZmlnOyAvLyDljp8gRy5mZm1wZWdDb25maWdcbiAgZGVlcFNlYXJjaFRlbXBvcmFyaWx5Q2xvc2U6IG51bWJlciB8IG51bGw7IC8vIOWOnyBHLmRlZXBTZWFyY2hUZW1wb3JhcmlseUNsb3NlXG59XG5cbmludGVyZmFjZSBTZXR0aW5nc0FjdGlvbnMge1xuICBzZXRUYWJJZDogKGlkOiBudW1iZXIpID0+IHZvaWQ7XG4gIHNldEVuYWJsZTogKHY6IGJvb2xlYW4pID0+IHZvaWQ7XG4gIHNldEluaXRTeW5jQ29tcGxldGU6ICh2OiBib29sZWFuKSA9PiB2b2lkO1xuICBzZXRJbml0TG9jYWxDb21wbGV0ZTogKHY6IGJvb2xlYW4pID0+IHZvaWQ7XG4gIHNldEV4dFJ1bGVzOiAocnVsZXM6IEV4dFJ1bGVbXSkgPT4gdm9pZDtcbiAgc2V0VHlwZVJ1bGVzOiAocnVsZXM6IFR5cGVSdWxlW10pID0+IHZvaWQ7XG4gIHNldFJlZ2V4UnVsZXM6IChydWxlczogUmVnZXhSdWxlW10pID0+IHZvaWQ7XG4gIHNldEJsb2NrVXJsOiAocnVsZXM6IEJsb2NrVXJsUnVsZVJhd1tdKSA9PiB2b2lkO1xuICB1cGRhdGVPcHRpb25zOiAocGF0Y2g6IFBhcnRpYWw8dHlwZW9mIERFRkFVTFRfT1BUSU9OUz4pID0+IHZvaWQ7XG4gIGFkZEJsb2NrVXJsVGFiOiAodGFiSWQ6IG51bWJlcikgPT4gdm9pZDtcbiAgcmVtb3ZlQmxvY2tVcmxUYWI6ICh0YWJJZDogbnVtYmVyKSA9PiB2b2lkO1xuICBhZGREYW1uVXJsVGFiOiAodGFiSWQ6IG51bWJlcikgPT4gdm9pZDtcbiAgcmVtb3ZlRGFtblVybFRhYjogKHRhYklkOiBudW1iZXIpID0+IHZvaWQ7XG4gIGFkZEZlYXRNb2JpbGVUYWI6ICh0YWJJZDogbnVtYmVyKSA9PiB2b2lkO1xuICByZW1vdmVGZWF0TW9iaWxlVGFiOiAodGFiSWQ6IG51bWJlcikgPT4gdm9pZDtcbiAgYWRkRmVhdEF1dG9Eb3duVGFiOiAodGFiSWQ6IG51bWJlcikgPT4gdm9pZDtcbiAgcmVtb3ZlRmVhdEF1dG9Eb3duVGFiOiAodGFiSWQ6IG51bWJlcikgPT4gdm9pZDtcbiAgc2V0RGVlcFNlYXJjaENsb3NlOiAodjogbnVtYmVyIHwgbnVsbCkgPT4gdm9pZDtcbiAgdG9nZ2xlU2NyaXB0VGFiOiAoc2NyaXB0OiBzdHJpbmcsIHRhYklkOiBudW1iZXIpID0+IGJvb2xlYW47XG4gIGhhc1NjcmlwdFRhYjogKHNjcmlwdDogc3RyaW5nLCB0YWJJZDogbnVtYmVyKSA9PiBib29sZWFuO1xuICAvKiog5LuOIGNocm9tZS5zdG9yYWdlLnN5bmMg5Yqg6L29KOi/mOWOnyBpbml0LmpzIEluaXRPcHRpb25zIOeahCBzeW5jIOmDqOWIhikgKi9cbiAgbG9hZEZyb21TeW5jOiAoKSA9PiBQcm9taXNlPHZvaWQ+O1xuICAvKiog5LuOIGNocm9tZS5zdG9yYWdlLmxvY2FsIOWKoOi9vSjov5jljp8gaW5pdC5qcyBJbml0T3B0aW9ucyDnmoQgbG9jYWwg6YOo5YiGKSAqL1xuICBsb2FkRnJvbUxvY2FsOiAoKSA9PiBQcm9taXNlPHZvaWQ+O1xuICAvKiog5oyB5LmF5YyWIG9wdGlvbnMgKyBFeHQvVHlwZS9SZWdleC9ibG9ja1VybCDliLAgc3RvcmFnZS5zeW5jICovXG4gIHBlcnNpc3RPcHRpb25zOiAoKSA9PiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgdHlwZSBTZXR0aW5nc1N0b3JlID0gU2V0dGluZ3NTdGF0ZSAmIFNldHRpbmdzQWN0aW9ucztcblxuLy8g5piv5ZCm5Li6IEZpcmVmb3go6L+Y5Y6fIGluaXQuanMg56ysIDE5MiDooYwpXG5jb25zdCBpc0ZpcmVmb3ggPVxuICB0eXBlb2YgbmF2aWdhdG9yICE9PSAndW5kZWZpbmVkJyAmJlxuICBuYXZpZ2F0b3IudXNlckFnZW50LmluY2x1ZGVzKCdGaXJlZm94JykgJiZcbiAgdHlwZW9mIChnbG9iYWxUaGlzIGFzIGFueSkuYnJvd3NlciAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgISEoZ2xvYmFsVGhpcyBhcyBhbnkpLmJyb3dzZXI/LnJ1bnRpbWU/LmdldEJyb3dzZXJJbmZvO1xuXG4vLyBDaHJvbWUg5Li754mI5pys5Y+3KOi/mOWOnyBpbml0LmpzIOesrCAxOTMtMTk0IOihjClcbmZ1bmN0aW9uIGRldGVjdFZlcnNpb24oKTogbnVtYmVyIHtcbiAgaWYgKHR5cGVvZiBuYXZpZ2F0b3IgPT09ICd1bmRlZmluZWQnKSByZXR1cm4gOTM7XG4gIGNvbnN0IG0gPSBuYXZpZ2F0b3IudXNlckFnZW50Lm1hdGNoKC8oPzpDaHJvbWV8RmlyZWZveClcXC8oW1xcZF0rKS8pO1xuICByZXR1cm4gbSAmJiBtWzFdID8gcGFyc2VJbnQobVsxXSwgMTApIDogOTM7XG59XG5cbmNvbnN0IGlzTW9iaWxlID1cbiAgdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgL01vYmlsZXxBbmRyb2lkfGlQaG9uZXxpUGFkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcblxuY29uc3QgSU5JVElBTF9PUFRJT05TID0geyAuLi5ERUZBVUxUX09QVElPTlMgfTtcblxuZXhwb3J0IGNvbnN0IHVzZVNldHRpbmdzU3RvcmUgPSBjcmVhdGU8U2V0dGluZ3NTdG9yZT4oKHNldCwgZ2V0KSA9PiAoe1xuICBpbml0U3luY0NvbXBsZXRlOiBmYWxzZSxcbiAgaW5pdExvY2FsQ29tcGxldGU6IGZhbHNlLFxuICB0YWJJZDogLTEsXG4gIGlzTW9iaWxlLFxuICBpc0ZpcmVmb3gsXG4gIHZlcnNpb246IGRldGVjdFZlcnNpb24oKSxcblxuICAvLyDnvJbor5Hpu5jorqTlgLxcbiAgRXh0OiB0b0V4dE1hcChERUZBVUxUX0VYVF9SVUxFUyksXG4gIFR5cGU6IHRvVHlwZU1hcChERUZBVUxUX1RZUEVfUlVMRVMpLFxuICBSZWdleDogY29tcGlsZVJlZ2V4KERFRkFVTFRfUkVHRVhfUlVMRVMpLFxuICBibG9ja1VybDogY29tcGlsZUJsb2NrVXJsKFtdKSxcblxuICBvcHRpb25zOiBJTklUSUFMX09QVElPTlMsXG5cbiAgZmVhdE1vYmlsZVRhYklkOiBuZXcgU2V0KCksXG4gIGZlYXRBdXRvRG93blRhYklkOiBuZXcgU2V0KCksXG4gIG1lZGlhQ29udHJvbDogeyAuLi5ERUZBVUxUX0xPQ0FMX1ZBUi5tZWRpYUNvbnRyb2wgfSxcbiAgcHJldmlld1Nob3dUaXRsZTogZmFsc2UsXG4gIHByZXZpZXdEZWxldGVEdXBsaWNhdGVGaWxlbmFtZXM6IGZhbHNlLFxuICBNM3U4SGlkZURvd25sb2FkZWRTZWdtZW50czogdHJ1ZSxcblxuICBlbmFibGU6IHRydWUsXG4gIGRhbW5Vcmw6IERFRkFVTFRfREFNTl9VUkxfUEFUVEVSTlMsXG4gIGRhbW5VcmxTZXQ6IG5ldyBTZXQoKSxcbiAgYmxvY2tVcmxTZXQ6IG5ldyBTZXQoKSxcbiAgYmxvY2tVcmxXaGl0ZTogZmFsc2UsXG4gIHNjcmlwdExpc3Q6IG5ldyBNYXAoXG4gICAgREVGQVVMVF9TQ1JJUFRfTElTVC5tYXAoKFtuYW1lLCBlbnRyeV0pID0+IFtcbiAgICAgIG5hbWUsXG4gICAgICB7IC4uLmVudHJ5LCB0YWJJZDogbmV3IFNldDxudW1iZXI+KCkgfSBhcyBTY3JpcHRFbnRyeSxcbiAgICBdKSxcbiAgKSxcbiAgZmZtcGVnQ29uZmlnOiBjcmVhdGVGZm1wZWdDb25maWcoMCksXG4gIGRlZXBTZWFyY2hUZW1wb3JhcmlseUNsb3NlOiBudWxsLFxuXG4gIHNldFRhYklkOiAoaWQpID0+IHNldCh7IHRhYklkOiBpZCB9KSxcbiAgc2V0RW5hYmxlOiAodikgPT4ge1xuICAgIHNldCh7IGVuYWJsZTogdiwgb3B0aW9uczogeyAuLi5nZXQoKS5vcHRpb25zLCBlbmFibGU6IHYgfSB9KTtcbiAgICB2b2lkIGNocm9tZS5zdG9yYWdlLnN5bmMuc2V0KHsgZW5hYmxlOiB2IH0pO1xuICAgIGNocm9tZS5hY3Rpb24uc2V0SWNvbih7XG4gICAgICBwYXRoOiB2ID8gJy9pbWcvaWNvbi5wbmcnIDogJy9pbWcvaWNvbi1kaXNhYmxlLnBuZycsXG4gICAgfSk7XG4gIH0sXG4gIHNldEluaXRTeW5jQ29tcGxldGU6ICh2KSA9PiBzZXQoeyBpbml0U3luY0NvbXBsZXRlOiB2IH0pLFxuICBzZXRJbml0TG9jYWxDb21wbGV0ZTogKHYpID0+IHNldCh7IGluaXRMb2NhbENvbXBsZXRlOiB2IH0pLFxuXG4gIHNldEV4dFJ1bGVzOiAocnVsZXMpID0+IHNldCh7IEV4dDogdG9FeHRNYXAocnVsZXMpIH0pLFxuICBzZXRUeXBlUnVsZXM6IChydWxlcykgPT4gc2V0KHsgVHlwZTogdG9UeXBlTWFwKHJ1bGVzKSB9KSxcbiAgc2V0UmVnZXhSdWxlczogKHJ1bGVzKSA9PiBzZXQoeyBSZWdleDogY29tcGlsZVJlZ2V4KHJ1bGVzKSB9KSxcbiAgc2V0QmxvY2tVcmw6IChydWxlcykgPT4gc2V0KHsgYmxvY2tVcmw6IGNvbXBpbGVCbG9ja1VybChydWxlcykgfSksXG5cbiAgdXBkYXRlT3B0aW9uczogKHBhdGNoKSA9PlxuICAgIHNldCgocykgPT4gKHsgb3B0aW9uczogeyAuLi5zLm9wdGlvbnMsIC4uLnBhdGNoIH0gfSkpLFxuXG4gIGFkZEJsb2NrVXJsVGFiOiAodGFiSWQpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChzLmJsb2NrVXJsU2V0KTtcbiAgICAgIG5leHQuYWRkKHRhYklkKTtcbiAgICAgIHJldHVybiB7IGJsb2NrVXJsU2V0OiBuZXh0IH07XG4gICAgfSksXG4gIHJlbW92ZUJsb2NrVXJsVGFiOiAodGFiSWQpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChzLmJsb2NrVXJsU2V0KTtcbiAgICAgIG5leHQuZGVsZXRlKHRhYklkKTtcbiAgICAgIHJldHVybiB7IGJsb2NrVXJsU2V0OiBuZXh0IH07XG4gICAgfSksXG4gIGFkZERhbW5VcmxUYWI6ICh0YWJJZCkgPT5cbiAgICBzZXQoKHMpID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHMuZGFtblVybFNldCk7XG4gICAgICBuZXh0LmFkZCh0YWJJZCk7XG4gICAgICByZXR1cm4geyBkYW1uVXJsU2V0OiBuZXh0IH07XG4gICAgfSksXG4gIHJlbW92ZURhbW5VcmxUYWI6ICh0YWJJZCkgPT5cbiAgICBzZXQoKHMpID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHMuZGFtblVybFNldCk7XG4gICAgICBuZXh0LmRlbGV0ZSh0YWJJZCk7XG4gICAgICByZXR1cm4geyBkYW1uVXJsU2V0OiBuZXh0IH07XG4gICAgfSksXG4gIGFkZEZlYXRNb2JpbGVUYWI6ICh0YWJJZCkgPT5cbiAgICBzZXQoKHMpID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHMuZmVhdE1vYmlsZVRhYklkKTtcbiAgICAgIG5leHQuYWRkKHRhYklkKTtcbiAgICAgIHJldHVybiB7IGZlYXRNb2JpbGVUYWJJZDogbmV4dCB9O1xuICAgIH0pLFxuICByZW1vdmVGZWF0TW9iaWxlVGFiOiAodGFiSWQpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChzLmZlYXRNb2JpbGVUYWJJZCk7XG4gICAgICBuZXh0LmRlbGV0ZSh0YWJJZCk7XG4gICAgICByZXR1cm4geyBmZWF0TW9iaWxlVGFiSWQ6IG5leHQgfTtcbiAgICB9KSxcbiAgYWRkRmVhdEF1dG9Eb3duVGFiOiAodGFiSWQpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChzLmZlYXRBdXRvRG93blRhYklkKTtcbiAgICAgIG5leHQuYWRkKHRhYklkKTtcbiAgICAgIHJldHVybiB7IGZlYXRBdXRvRG93blRhYklkOiBuZXh0IH07XG4gICAgfSksXG4gIHJlbW92ZUZlYXRBdXRvRG93blRhYjogKHRhYklkKSA9PlxuICAgIHNldCgocykgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocy5mZWF0QXV0b0Rvd25UYWJJZCk7XG4gICAgICBuZXh0LmRlbGV0ZSh0YWJJZCk7XG4gICAgICByZXR1cm4geyBmZWF0QXV0b0Rvd25UYWJJZDogbmV4dCB9O1xuICAgIH0pLFxuICBzZXREZWVwU2VhcmNoQ2xvc2U6ICh2KSA9PiBzZXQoeyBkZWVwU2VhcmNoVGVtcG9yYXJpbHlDbG9zZTogdiB9KSxcblxuICB0b2dnbGVTY3JpcHRUYWI6IChzY3JpcHQsIHRhYklkKSA9PiB7XG4gICAgY29uc3QgcyA9IGdldCgpO1xuICAgIGNvbnN0IGVudHJ5ID0gcy5zY3JpcHRMaXN0LmdldChzY3JpcHQpO1xuICAgIGlmICghZW50cnkpIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChzLnNjcmlwdExpc3QpO1xuICAgIGNvbnN0IG5leHRFbnRyeSA9IHsgLi4uZW50cnksIHRhYklkOiBuZXcgU2V0KGVudHJ5LnRhYklkKSB9O1xuICAgIGlmIChuZXh0RW50cnkudGFiSWQuaGFzKHRhYklkKSkge1xuICAgICAgbmV4dEVudHJ5LnRhYklkLmRlbGV0ZSh0YWJJZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG5leHRFbnRyeS50YWJJZC5hZGQodGFiSWQpO1xuICAgIH1cbiAgICBuZXh0LnNldChzY3JpcHQsIG5leHRFbnRyeSk7XG4gICAgc2V0KHsgc2NyaXB0TGlzdDogbmV4dCB9KTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSxcblxuICBoYXNTY3JpcHRUYWI6IChzY3JpcHQsIHRhYklkKSA9PiB7XG4gICAgY29uc3QgZW50cnkgPSBnZXQoKS5zY3JpcHRMaXN0LmdldChzY3JpcHQpO1xuICAgIHJldHVybiBlbnRyeSA/IGVudHJ5LnRhYklkLmhhcyh0YWJJZCkgOiBmYWxzZTtcbiAgfSxcblxuICBsb2FkRnJvbVN5bmM6IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgY2hyb21lLnN0b3JhZ2Uuc3luYy5nZXQoe1xuICAgICAgLi4uREVGQVVMVF9PUFRJT05TLFxuICAgICAgRXh0OiBERUZBVUxUX0VYVF9SVUxFUyxcbiAgICAgIFR5cGU6IERFRkFVTFRfVFlQRV9SVUxFUyxcbiAgICAgIFJlZ2V4OiBERUZBVUxUX1JFR0VYX1JVTEVTLFxuICAgICAgYmxvY2tVcmw6IFtdIGFzIEJsb2NrVXJsUnVsZVJhd1tdLFxuICAgIH0pO1xuXG4gICAgLy8g56Gu5L+d6buY6K6k5YC8XG4gICAgZm9yIChjb25zdCBrZXkgaW4gREVGQVVMVF9PUFRJT05TKSB7XG4gICAgICBpZiAoZGF0YVtrZXkgYXMga2V5b2YgdHlwZW9mIGRhdGFdID09PSB1bmRlZmluZWQgfHwgZGF0YVtrZXkgYXMga2V5b2YgdHlwZW9mIGRhdGFdID09PSBudWxsKSB7XG4gICAgICAgIChkYXRhIGFzIGFueSlba2V5XSA9IChERUZBVUxUX09QVElPTlMgYXMgYW55KVtrZXldO1xuICAgICAgfVxuICAgIH1cblxuICAgIGNvbnN0IHBhdGNoOiBQYXJ0aWFsPFNldHRpbmdzU3RhdGU+ID0ge1xuICAgICAgRXh0OiB0b0V4dE1hcCgoZGF0YS5FeHQgYXMgRXh0UnVsZVtdKSA/PyBERUZBVUxUX0VYVF9SVUxFUyksXG4gICAgICBUeXBlOiB0b1R5cGVNYXAoKGRhdGEuVHlwZSBhcyBUeXBlUnVsZVtdKSA/PyBERUZBVUxUX1RZUEVfUlVMRVMpLFxuICAgICAgUmVnZXg6IGNvbXBpbGVSZWdleCgoZGF0YS5SZWdleCBhcyBSZWdleFJ1bGVbXSkgPz8gREVGQVVMVF9SRUdFWF9SVUxFUyksXG4gICAgICBibG9ja1VybDogY29tcGlsZUJsb2NrVXJsKChkYXRhLmJsb2NrVXJsIGFzIEJsb2NrVXJsUnVsZVJhd1tdKSA/PyBbXSksXG4gICAgICBvcHRpb25zOiB7IC4uLkRFRkFVTFRfT1BUSU9OUywgLi4uKGRhdGEgYXMgYW55KSB9LFxuICAgICAgZW5hYmxlOiAoZGF0YSBhcyBhbnkpLmVuYWJsZSA/PyB0cnVlLFxuICAgICAgYmxvY2tVcmxXaGl0ZTogKGRhdGEgYXMgYW55KS5ibG9ja1VybFdoaXRlID8/IGZhbHNlLFxuICAgICAgaW5pdFN5bmNDb21wbGV0ZTogdHJ1ZSxcbiAgICB9O1xuICAgIHNldChwYXRjaCk7XG5cbiAgICAvLyDorr7nva4gc2lkZVBhbmVsIOihjOS4ulxuICAgIGlmICghaXNGaXJlZm94KSB7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBjaHJvbWUuc2lkZVBhbmVsLnNldFBhbmVsQmVoYXZpb3Ioe1xuICAgICAgICAgIG9wZW5QYW5lbE9uQWN0aW9uQ2xpY2s6IChkYXRhIGFzIGFueSkuc2lkZVBhbmVsID8/IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICAgIH0gY2F0Y2gge1xuICAgICAgICAvKiBzaWRlUGFuZWwg5Y+v6IO95ZyoIFNXIOS4reS4jeWPr+eUqCAqL1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBsb2FkRnJvbUxvY2FsOiBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgYXJlYSA9IGNocm9tZS5zdG9yYWdlLnNlc3Npb24gPz8gY2hyb21lLnN0b3JhZ2UubG9jYWw7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGFyZWEuZ2V0KHtcbiAgICAgIC4uLkRFRkFVTFRfTE9DQUxfVkFSLFxuICAgIH0pO1xuICAgIHNldCh7XG4gICAgICBmZWF0TW9iaWxlVGFiSWQ6IG5ldyBTZXQoZGF0YS5mZWF0TW9iaWxlVGFiSWQgPz8gW10pLFxuICAgICAgZmVhdEF1dG9Eb3duVGFiSWQ6IG5ldyBTZXQoZGF0YS5mZWF0QXV0b0Rvd25UYWJJZCA/PyBbXSksXG4gICAgICBtZWRpYUNvbnRyb2w6IGRhdGEubWVkaWFDb250cm9sID8/IERFRkFVTFRfTE9DQUxfVkFSLm1lZGlhQ29udHJvbCxcbiAgICAgIHByZXZpZXdTaG93VGl0bGU6IGRhdGEucHJldmlld1Nob3dUaXRsZSA/PyBmYWxzZSxcbiAgICAgIHByZXZpZXdEZWxldGVEdXBsaWNhdGVGaWxlbmFtZXM6IGRhdGEucHJldmlld0RlbGV0ZUR1cGxpY2F0ZUZpbGVuYW1lcyA/PyBmYWxzZSxcbiAgICAgIE0zdThIaWRlRG93bmxvYWRlZFNlZ21lbnRzOiBkYXRhLk0zdThIaWRlRG93bmxvYWRlZFNlZ21lbnRzID8/IHRydWUsXG4gICAgICBpbml0TG9jYWxDb21wbGV0ZTogdHJ1ZSxcbiAgICB9KTtcbiAgfSxcblxuICBwZXJzaXN0T3B0aW9uczogYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHsgRXh0LCBUeXBlLCBSZWdleCwgYmxvY2tVcmwsIG9wdGlvbnMgfSA9IGdldCgpO1xuICAgIGNvbnN0IHsgYmxvY2tVcmw6IF9kcm9wLCAuLi5yZXN0T3B0aW9ucyB9ID0gb3B0aW9ucztcbiAgICB2b2lkIF9kcm9wO1xuICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLnN5bmMuc2V0KHtcbiAgICAgIEV4dDogQXJyYXkuZnJvbShFeHQudmFsdWVzKCkpLFxuICAgICAgVHlwZTogQXJyYXkuZnJvbShUeXBlLnZhbHVlcygpKSxcbiAgICAgIFJlZ2V4OiBSZWdleC5tYXAoKHIpID0+ICh7XG4gICAgICAgIHR5cGU6IHIucmVnZXguZmxhZ3MuaW5jbHVkZXMoJ2cnKVxuICAgICAgICAgID8gci5yZWdleC5mbGFncy5pbmNsdWRlcygnaScpID8gJ2lnJyA6ICdnJ1xuICAgICAgICAgIDogci5yZWdleC5mbGFncy5pbmNsdWRlcygnaScpID8gJ2knIDogJycsXG4gICAgICAgIHJlZ2V4OiByLnJlZ2V4LnNvdXJjZSxcbiAgICAgICAgZXh0OiByLmV4dCxcbiAgICAgICAgYmxhY2tMaXN0OiByLmJsYWNrTGlzdCxcbiAgICAgICAgc3RhdGU6IHIuc3RhdGUsXG4gICAgICB9KSkgYXMgUmVnZXhSdWxlW10sXG4gICAgICBibG9ja1VybDogYmxvY2tVcmwubWFwKChyKSA9PiAoe1xuICAgICAgICB1cmw6IHIudXJsLnNvdXJjZSxcbiAgICAgICAgc3RhdGU6IHIuc3RhdGUsXG4gICAgICB9KSksXG4gICAgICAuLi5yZXN0T3B0aW9ucyxcbiAgICB9KTtcbiAgfSxcbn0pKTtcbiIsImltcG9ydCB7IGNyZWF0ZSB9IGZyb20gJ3p1c3RhbmQnO1xuXG4vKipcbiAqIE1lZGlhIOaVsOaNruaooeWeiyDigJTigJQg6L+Y5Y6f5Y6fIGJhY2tncm91bmQuanMg55qEIGNhY2hlRGF0YSDlqpLkvZPpoblcbiAqIDE6MSDov5jljp/ljp/pobnnm67nrKwgMjQxLTI1NSDooYznmoQgaW5mbyDnu5PmnoRcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBNZWRpYUl0ZW0ge1xuICBuYW1lPzogc3RyaW5nO1xuICB1cmw6IHN0cmluZztcbiAgc2l6ZT86IG51bWJlcjtcbiAgZXh0Pzogc3RyaW5nO1xuICB0eXBlPzogc3RyaW5nO1xuICB0YWJJZDogbnVtYmVyO1xuICBpc1JlZ2V4PzogYm9vbGVhbjtcbiAgcmVxdWVzdElkOiBzdHJpbmc7XG4gIGluaXRpYXRvcj86IHN0cmluZztcbiAgcmVxdWVzdEhlYWRlcnM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICBjb29raWU/OiBzdHJpbmc7XG4gIGdldFRpbWU/OiBudW1iZXI7XG4gIC8qKiDoo4Xovb3pobXpnaLkv6Hmga8o5Y6fIGluZm8udGl0bGUgLyBmYXZJY29uVXJsIC8gd2ViVXJsKSAqL1xuICB0aXRsZT86IHN0cmluZztcbiAgZmF2SWNvblVybD86IHN0cmluZztcbiAgd2ViVXJsPzogc3RyaW5nO1xuICAvKiog5q2j5YiZ5Yy56YWN55qE5aSH5rOo5omp5bGVICovXG4gIGV4dHJhRXh0Pzogc3RyaW5nO1xuICAvKiogbWltZSjljp8gZGF0YS5taW1lKSAqL1xuICBtaW1lPzogc3RyaW5nO1xuICAvKiog6Kej5p6Q5Zmo6Lev5b6EKOeUqOS6jiBvcGVuUGFyc2VyKSAqL1xuICBwYXJzaW5nPzogJ20zdTgnIHwgJ21wZCc7XG4gIC8qKiBwb3B1cCDnq6/nmoQgVUkg54q25oCBKOeLrOeri+S6juWOn+mhueebrikgKi9cbiAgc2VsZWN0ZWQ/OiBib29sZWFuO1xuICBoaWRkZW4/OiBib29sZWFuO1xufVxuXG5pbnRlcmZhY2UgTWVkaWFTdGF0ZSB7XG4gIC8qKlxuICAgKiDmjIkgdGFiSWQg5YiG5qG2KOi/mOWOn+WOnyBjYWNoZURhdGFbdGFiSWRdKVxuICAgKiDms6jmhI865a2Y5YKoIGNocm9tZS5zdG9yYWdlIOaXtumcgOW6j+WIl+WMluS4uuaZrumAmuWvueixoVxuICAgKi9cbiAgYnVja2V0czogTWFwPG51bWJlciwgTWVkaWFJdGVtW10+O1xuICAvKiog5Y6fIGNhY2hlRGF0YS5pbml0IOagh+W/lyjliJ3mrKHmnKrliqDovb3lrozml7bkuLogdHJ1ZSkgKi9cbiAgaW5pdGlhbGl6ZWQ6IGJvb2xlYW47XG59XG5cbmludGVyZmFjZSBNZWRpYUFjdGlvbnMge1xuICAvKiog5re75Yqg5Yiw5oyH5a6aIHRhYijov5jljp8gY2FjaGVEYXRhW3RhYklkXS5wdXNoKSAqL1xuICBwdXNoOiAoaXRlbTogTWVkaWFJdGVtKSA9PiBib29sZWFuO1xuICAvKiog56e76Zmk5Y2V5p2hKOaMiSB0YWJJZCArIHJlcXVlc3RJZCkgKi9cbiAgcmVtb3ZlOiAodGFiSWQ6IG51bWJlciwgcmVxdWVzdElkOiBzdHJpbmcpID0+IHZvaWQ7XG4gIC8qKiDmuIXnqbrmn5AgdGFiKOi/mOWOnyBkZWxldGUgY2FjaGVEYXRhW3RhYklkXSkgKi9cbiAgY2xlYXJUYWI6ICh0YWJJZDogbnVtYmVyKSA9PiB2b2lkO1xuICAvKiog5riF56m66Zmk5oyH5a6aIHRhYiDlpJbnmoTlhbbku5YgdGFiKOi/mOWOnyBjbGVhckRhdGEgb3RoZXIpICovXG4gIGNsZWFyT3RoZXJUYWJzOiAoa2VlcFRhYklkOiBudW1iZXIpID0+IHZvaWQ7XG4gIC8qKiDmuIXnqbrlhajpg6ggKi9cbiAgY2xlYXJBbGw6ICgpID0+IHZvaWQ7XG4gIC8qKiDojrflj5bmn5AgdGFiIOaVsOaNrijov5jljp8gZ2V0RGF0YSBieSB0YWJJZCkgKi9cbiAgZ2V0QnlUYWI6ICh0YWJJZDogbnVtYmVyKSA9PiBNZWRpYUl0ZW1bXTtcbiAgLyoqIOaMiSByZXF1ZXN0SWQg5pWw57uE5p+lKOi/mOWOnyBnZXREYXRhIGJ5IHJlcXVlc3RJZFtdKSAqL1xuICBnZXRCeVJlcXVlc3RJZHM6IChyZXF1ZXN0SWRzOiBzdHJpbmdbXSkgPT4gTWVkaWFJdGVtW107XG4gIC8qKiDojrflj5blhajpg6jmlbDmja4o6L+Y5Y6fIGdldEFsbERhdGEpICovXG4gIGdldEFsbDogKCkgPT4gUmVjb3JkPG51bWJlciwgTWVkaWFJdGVtW10+O1xuICAvKiog5LuOIGNocm9tZS5zdG9yYWdlIOWKoOi9vSBjYWNoZURhdGEo6L+Y5Y6fIGluaXQuanMgTWVkaWFEYXRhIOWKoOi9vSkgKi9cbiAgbG9hZEZyb21TdG9yYWdlOiAoKSA9PiBQcm9taXNlPHZvaWQ+O1xuICAvKiog5oyB5LmF5YyW5YiwIGNocm9tZS5zdG9yYWdlKOi/mOWOnyBhbGFybXMgc2F2ZSkgKi9cbiAgcGVyc2lzdDogKCkgPT4gUHJvbWlzZTx2b2lkPjtcbiAgLyoqIOS4u+WKqOaMgeS5heWMlijov5jljp8gcHVzaERhdGEg5raI5oGvKSAqL1xuICBmb3JjZVBlcnNpc3Q6ICgpID0+IFByb21pc2U8dm9pZD47XG4gIC8qKiDmoIforrDliJ3lp4vljJblrozmiJAgKi9cbiAgc2V0SW5pdGlhbGl6ZWQ6ICh2OiBib29sZWFuKSA9PiB2b2lkO1xuICAvKiogVUk65YiH5o2i5p+Q5p2h5aqS5L2T5ZyoIHBvcHVwIOS4reeahOmAieS4reaAgSjkuI3mjIHkuYXljJYpICovXG4gIHRvZ2dsZVNlbGVjdGVkOiAodGFiSWQ6IG51bWJlciwgcmVxdWVzdElkOiBzdHJpbmcpID0+IHZvaWQ7XG4gIC8qKiBVSTrmibnph4/orr7nva7mn5AgdGFiIOWIl+ihqOeahOmAieS4reaAgSjkuI3mjIHkuYXljJYpICovXG4gIHNldFNlbGVjdGVkQWxsOiAodGFiSWQ6IG51bWJlciwgdmFsdWU6IGJvb2xlYW4pID0+IHZvaWQ7XG4gIC8qKiBVSTrlj43pgInmn5AgdGFiIOWIl+ihqCjkuI3mjIHkuYXljJYs6L+Y5Y6f5Y6fIHBvcHVwLmpzIGludmVydFNlbGVjdGlvbikgKi9cbiAgaW52ZXJ0U2VsZWN0aW9uOiAodGFiSWQ6IG51bWJlcikgPT4gdm9pZDtcbn1cblxuZXhwb3J0IHR5cGUgTWVkaWFTdG9yZSA9IE1lZGlhU3RhdGUgJiBNZWRpYUFjdGlvbnM7XG5cbmNvbnN0IElOSVRJQUw6IE1lZGlhU3RhdGUgPSB7XG4gIGJ1Y2tldHM6IG5ldyBNYXAoKSxcbiAgaW5pdGlhbGl6ZWQ6IHRydWUsIC8vIOm7mOiupCB0cnVlLFNXIOmHjeWQr+aXtuS8muiiqyBsb2FkRnJvbVN0b3JhZ2Ug6YeN572uXG59O1xuXG5leHBvcnQgY29uc3QgdXNlTWVkaWFTdG9yZSA9IGNyZWF0ZTxNZWRpYVN0b3JlPigoc2V0LCBnZXQpID0+ICh7XG4gIC4uLklOSVRJQUwsXG5cbiAgcHVzaDogKGl0ZW0pID0+IHtcbiAgICBjb25zdCB7IGJ1Y2tldHMsIGluaXRpYWxpemVkIH0gPSBnZXQoKTtcbiAgICBpZiAoIWluaXRpYWxpemVkKSByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgbmV4dCA9IG5ldyBNYXAoYnVja2V0cyk7XG4gICAgY29uc3QgbGlzdCA9IG5leHQuZ2V0KGl0ZW0udGFiSWQpID8/IFtdO1xuICAgIGlmIChsaXN0LnNvbWUoKG0pID0+IG0ucmVxdWVzdElkID09PSBpdGVtLnJlcXVlc3RJZCAmJiBtLnVybCA9PT0gaXRlbS51cmwpKSB7XG4gICAgICByZXR1cm4gZmFsc2U7IC8vIOW3suWtmOWcqFxuICAgIH1cbiAgICBuZXh0LnNldChpdGVtLnRhYklkLCBbLi4ubGlzdCwgaXRlbV0pO1xuICAgIHNldCh7IGJ1Y2tldHM6IG5leHQgfSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0sXG5cbiAgcmVtb3ZlOiAodGFiSWQsIHJlcXVlc3RJZCkgPT5cbiAgICBzZXQoKHMpID0+IHtcbiAgICAgIGNvbnN0IGxpc3QgPSBzLmJ1Y2tldHMuZ2V0KHRhYklkKTtcbiAgICAgIGlmICghbGlzdCkgcmV0dXJuIHM7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChzLmJ1Y2tldHMpO1xuICAgICAgY29uc3QgZmlsdGVyZWQgPSBsaXN0LmZpbHRlcigobSkgPT4gbS5yZXF1ZXN0SWQgIT09IHJlcXVlc3RJZCk7XG4gICAgICBpZiAoZmlsdGVyZWQubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIG5leHQuZGVsZXRlKHRhYklkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5leHQuc2V0KHRhYklkLCBmaWx0ZXJlZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4geyBidWNrZXRzOiBuZXh0IH07XG4gICAgfSksXG5cbiAgY2xlYXJUYWI6ICh0YWJJZCkgPT5cbiAgICBzZXQoKHMpID0+IHtcbiAgICAgIGlmICghcy5idWNrZXRzLmhhcyh0YWJJZCkpIHJldHVybiBzO1xuICAgICAgY29uc3QgbmV4dCA9IG5ldyBNYXAocy5idWNrZXRzKTtcbiAgICAgIG5leHQuZGVsZXRlKHRhYklkKTtcbiAgICAgIHJldHVybiB7IGJ1Y2tldHM6IG5leHQgfTtcbiAgICB9KSxcblxuICBjbGVhck90aGVyVGFiczogKGtlZXBUYWJJZCkgPT5cbiAgICBzZXQoKHMpID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwPG51bWJlciwgTWVkaWFJdGVtW10+KCk7XG4gICAgICBjb25zdCBrZWVwID0gcy5idWNrZXRzLmdldChrZWVwVGFiSWQpO1xuICAgICAgaWYgKGtlZXApIG5leHQuc2V0KGtlZXBUYWJJZCwga2VlcCk7XG4gICAgICByZXR1cm4geyBidWNrZXRzOiBuZXh0IH07XG4gICAgfSksXG5cbiAgY2xlYXJBbGw6ICgpID0+IHNldCh7IGJ1Y2tldHM6IG5ldyBNYXAoKSB9KSxcblxuICBnZXRCeVRhYjogKHRhYklkKSA9PiBnZXQoKS5idWNrZXRzLmdldCh0YWJJZCkgPz8gW10sXG5cbiAgZ2V0QnlSZXF1ZXN0SWRzOiAocmVxdWVzdElkcykgPT4ge1xuICAgIGNvbnN0IHJlc3VsdDogTWVkaWFJdGVtW10gPSBbXTtcbiAgICBjb25zdCBzZXRfID0gbmV3IFNldChyZXF1ZXN0SWRzKTtcbiAgICBmb3IgKGNvbnN0IGxpc3Qgb2YgZ2V0KCkuYnVja2V0cy52YWx1ZXMoKSkge1xuICAgICAgZm9yIChjb25zdCBtIG9mIGxpc3QpIHtcbiAgICAgICAgaWYgKHNldF8uaGFzKG0ucmVxdWVzdElkKSkgcmVzdWx0LnB1c2gobSk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgZ2V0QWxsOiAoKSA9PiB7XG4gICAgY29uc3Qgb2JqOiBSZWNvcmQ8bnVtYmVyLCBNZWRpYUl0ZW1bXT4gPSB7fTtcbiAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBnZXQoKS5idWNrZXRzKSBvYmpba10gPSB2O1xuICAgIHJldHVybiBvYmo7XG4gIH0sXG5cbiAgbG9hZEZyb21TdG9yYWdlOiBhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgYXJlYSA9IGNocm9tZS5zdG9yYWdlLnNlc3Npb24gPz8gY2hyb21lLnN0b3JhZ2UubG9jYWw7XG4gICAgY29uc3QgZGF0YSA9IGF3YWl0IGFyZWEuZ2V0KCdNZWRpYURhdGEnKTtcbiAgICBpZiAoZGF0YS5NZWRpYURhdGE/LmluaXQpIHtcbiAgICAgIHNldCh7IGJ1Y2tldHM6IG5ldyBNYXAoKSwgaW5pdGlhbGl6ZWQ6IHRydWUgfSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnN0IGJ1Y2tldHMgPSBuZXcgTWFwPG51bWJlciwgTWVkaWFJdGVtW10+KCk7XG4gICAgaWYgKGRhdGEuTWVkaWFEYXRhKSB7XG4gICAgICAvLyDlj43luo/liJfljJYo5Y6f6aG555uu5a2Y55qE5piv5pmu6YCaIG9iamVjdCzov5nph4zovazlm54gTWFwKVxuICAgICAgY29uc3QgcmF3ID0gZGF0YS5NZWRpYURhdGEuYnVja2V0cyA/PyBkYXRhLk1lZGlhRGF0YTtcbiAgICAgIGZvciAoY29uc3Qga2V5IGluIHJhdykge1xuICAgICAgICBjb25zdCB0YWJJZCA9IE51bWJlcihrZXkpO1xuICAgICAgICBpZiAoIU51bWJlci5pc05hTih0YWJJZCkgJiYgQXJyYXkuaXNBcnJheShyYXdba2V5XSkpIHtcbiAgICAgICAgICBidWNrZXRzLnNldCh0YWJJZCwgcmF3W2tleV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHNldCh7IGJ1Y2tldHMsIGluaXRpYWxpemVkOiB0cnVlIH0pO1xuICB9LFxuXG4gIHBlcnNpc3Q6IGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB7IGJ1Y2tldHMgfSA9IGdldCgpO1xuICAgIC8vIOW6j+WIl+WMluS4uuaZrumAmuWvueixoShjaHJvbWUuc3RvcmFnZSDkuI3mlK/mjIEgTWFwKVxuICAgIGNvbnN0IG9iajogUmVjb3JkPG51bWJlciwgTWVkaWFJdGVtW10+ID0ge307XG4gICAgZm9yIChjb25zdCBbaywgdl0gb2YgYnVja2V0cykgb2JqW2tdID0gdjtcbiAgICBjb25zdCBhcmVhID0gY2hyb21lLnN0b3JhZ2Uuc2Vzc2lvbiA/PyBjaHJvbWUuc3RvcmFnZS5sb2NhbDtcbiAgICBhd2FpdCBhcmVhLnNldCh7IE1lZGlhRGF0YTogeyBidWNrZXRzOiBvYmosIGluaXQ6IGZhbHNlIH0gfSk7XG4gIH0sXG5cbiAgZm9yY2VQZXJzaXN0OiBhc3luYyAoKSA9PiBnZXQoKS5wZXJzaXN0KCksXG5cbiAgc2V0SW5pdGlhbGl6ZWQ6ICh2KSA9PiBzZXQoeyBpbml0aWFsaXplZDogdiB9KSxcblxuICB0b2dnbGVTZWxlY3RlZDogKHRhYklkLCByZXF1ZXN0SWQpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBjb25zdCBsaXN0ID0gcy5idWNrZXRzLmdldCh0YWJJZCk7XG4gICAgICBpZiAoIWxpc3QpIHJldHVybiBzO1xuICAgICAgY29uc3QgaWR4ID0gbGlzdC5maW5kSW5kZXgoKG0pID0+IG0ucmVxdWVzdElkID09PSByZXF1ZXN0SWQpO1xuICAgICAgaWYgKGlkeCA9PT0gLTEpIHJldHVybiBzO1xuICAgICAgY29uc3QgaXRlbSA9IGxpc3RbaWR4XTtcbiAgICAgIGlmICghaXRlbSkgcmV0dXJuIHM7XG4gICAgICBjb25zdCBuZXh0TGlzdCA9IGxpc3Quc2xpY2UoKTtcbiAgICAgIG5leHRMaXN0W2lkeF0gPSB7IC4uLml0ZW0sIHNlbGVjdGVkOiAhaXRlbS5zZWxlY3RlZCB9O1xuICAgICAgY29uc3QgbmV4dCA9IG5ldyBNYXAocy5idWNrZXRzKTtcbiAgICAgIG5leHQuc2V0KHRhYklkLCBuZXh0TGlzdCk7XG4gICAgICByZXR1cm4geyBidWNrZXRzOiBuZXh0IH07XG4gICAgfSksXG5cbiAgc2V0U2VsZWN0ZWRBbGw6ICh0YWJJZCwgdmFsdWUpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBjb25zdCBsaXN0ID0gcy5idWNrZXRzLmdldCh0YWJJZCk7XG4gICAgICBpZiAoIWxpc3QgfHwgbGlzdC5sZW5ndGggPT09IDApIHJldHVybiBzO1xuICAgICAgY29uc3QgbmV4dExpc3QgPSBsaXN0Lm1hcCgobSkgPT4gKHsgLi4ubSwgc2VsZWN0ZWQ6IHZhbHVlIH0pKTtcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHMuYnVja2V0cyk7XG4gICAgICBuZXh0LnNldCh0YWJJZCwgbmV4dExpc3QpO1xuICAgICAgcmV0dXJuIHsgYnVja2V0czogbmV4dCB9O1xuICAgIH0pLFxuXG4gIGludmVydFNlbGVjdGlvbjogKHRhYklkKSA9PlxuICAgIHNldCgocykgPT4ge1xuICAgICAgY29uc3QgbGlzdCA9IHMuYnVja2V0cy5nZXQodGFiSWQpO1xuICAgICAgaWYgKCFsaXN0IHx8IGxpc3QubGVuZ3RoID09PSAwKSByZXR1cm4gcztcbiAgICAgIGNvbnN0IG5leHRMaXN0ID0gbGlzdC5tYXAoKG0pID0+ICh7IC4uLm0sIHNlbGVjdGVkOiAhbS5zZWxlY3RlZCB9KSk7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChzLmJ1Y2tldHMpO1xuICAgICAgbmV4dC5zZXQodGFiSWQsIG5leHRMaXN0KTtcbiAgICAgIHJldHVybiB7IGJ1Y2tldHM6IG5leHQgfTtcbiAgICB9KSxcbn0pKTtcbiIsImltcG9ydCB7IGNyZWF0ZSB9IGZyb20gJ3p1c3RhbmQnO1xuXG4vKipcbiAqIFJ1bnRpbWUgU3RvcmUg4oCU4oCUIOi/mOWOn+WOn+mhueebrui/kOihjOaXtuS4tOaXtueKtuaAgSjkuI3mjIHkuYXljJYpXG4gKiAtIEcudXJsTWFwICAgICAgICAgIC0+IHVybE1hcDogTWFwPHRhYklkLCBTZXQ8dXJsPj4oVVJMIOafpemHjSlcbiAqIC0gRy5yZXF1ZXN0SGVhZGVycyAgLT4gcmVxdWVzdEhlYWRlcnM6IE1hcDxyZXF1ZXN0SWQsIGhlYWRlcnM+KOS4tOaXtuivt+axguWktClcbiAqIC0gRy5ibGFja0xpc3QgICAgICAgLT4gYmxhY2tMaXN0OiBTZXQ8cmVxdWVzdElkPijmraPliJnlsY/olL3otYTmupApXG4gKiDms6g6Ry5ibG9ja1VybFNldCAvIEcuZGFtblVybFNldCAvIEcuc2NyaXB0TGlzdCDlt7LlnKggc2V0dGluZ3Mgc3RvcmUg5Lit566h55CGXG4gKi9cbmludGVyZmFjZSBSdW50aW1lU3RhdGUge1xuICB1cmxNYXA6IE1hcDxudW1iZXIsIFNldDxzdHJpbmc+PjtcbiAgcmVxdWVzdEhlYWRlcnM6IE1hcDxzdHJpbmcsIEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZT86IHN0cmluZyB9PiB8IFJlY29yZDxzdHJpbmcsIHN0cmluZz4+O1xuICBibGFja0xpc3Q6IFNldDxzdHJpbmc+O1xuICAvKiog6Ziy5oqW6K6h5pWwKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCAzMS0zMyDooYwpICovXG4gIGRlYm91bmNlVGltZXI6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkO1xuICBkZWJvdW5jZUNvdW50OiBudW1iZXI7XG4gIGRlYm91bmNlVGltZTogbnVtYmVyO1xufVxuXG5pbnRlcmZhY2UgUnVudGltZUFjdGlvbnMge1xuICAvKiogVVJMIOafpemHjSAtIOaMiSB0YWJJZCDliIbmobYo6L+Y5Y6fIGJhY2tncm91bmQuanMg56ysIDIyMS0yMzEg6KGMKSAqL1xuICBoYXNVcmw6ICh0YWJJZDogbnVtYmVyLCB1cmw6IHN0cmluZykgPT4gYm9vbGVhbjtcbiAgYWRkVXJsOiAodGFiSWQ6IG51bWJlciwgdXJsOiBzdHJpbmcsIG1heEJ1Y2tldFNpemU/OiBudW1iZXIpID0+IHZvaWQ7XG4gIGNsZWFyVGFiVXJsczogKHRhYklkOiBudW1iZXIpID0+IHZvaWQ7XG4gIHNldFJlcXVlc3RIZWFkZXJzOiAoXG4gICAgcmVxdWVzdElkOiBzdHJpbmcsXG4gICAgaGVhZGVyczogQXJyYXk8eyBuYW1lOiBzdHJpbmc7IHZhbHVlPzogc3RyaW5nIH0+IHwgUmVjb3JkPHN0cmluZywgc3RyaW5nPixcbiAgKSA9PiB2b2lkO1xuICBnZXRSZXF1ZXN0SGVhZGVyczogKFxuICAgIHJlcXVlc3RJZDogc3RyaW5nLFxuICApID0+IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZT86IHN0cmluZyB9PiB8IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ7XG4gIGRlbGV0ZVJlcXVlc3RIZWFkZXJzOiAocmVxdWVzdElkOiBzdHJpbmcpID0+IHZvaWQ7XG4gIGFkZEJsYWNrTGlzdDogKHJlcXVlc3RJZDogc3RyaW5nKSA9PiB2b2lkO1xuICBoYXNCbGFja0xpc3Q6IChyZXF1ZXN0SWQ6IHN0cmluZykgPT4gYm9vbGVhbjtcbiAgZGVsZXRlQmxhY2tMaXN0OiAocmVxdWVzdElkOiBzdHJpbmcpID0+IHZvaWQ7XG4gIGNsZWFyQWxsOiAoKSA9PiB2b2lkO1xuICBzZXREZWJvdW5jZTogKHRpbWVyOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZCwgY291bnQ/OiBudW1iZXIsIHRpbWU/OiBudW1iZXIpID0+IHZvaWQ7XG4gIC8qKiDmuIXnkIbotoXov4cgMTAyNDAg6aG555qEIHJlcXVlc3RIZWFkZXJzKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCAxMTAwLTExMDIg6KGMKSAqL1xuICBwcnVuZVJlcXVlc3RIZWFkZXJzOiAoKSA9PiB2b2lkO1xufVxuXG5leHBvcnQgdHlwZSBSdW50aW1lU3RvcmUgPSBSdW50aW1lU3RhdGUgJiBSdW50aW1lQWN0aW9ucztcblxuZXhwb3J0IGNvbnN0IHVzZVJ1bnRpbWVTdG9yZSA9IGNyZWF0ZTxSdW50aW1lU3RvcmU+KChzZXQsIGdldCkgPT4gKHtcbiAgdXJsTWFwOiBuZXcgTWFwKCksXG4gIHJlcXVlc3RIZWFkZXJzOiBuZXcgTWFwKCksXG4gIGJsYWNrTGlzdDogbmV3IFNldCgpLFxuICBkZWJvdW5jZVRpbWVyOiB1bmRlZmluZWQsXG4gIGRlYm91bmNlQ291bnQ6IDAsXG4gIGRlYm91bmNlVGltZTogMCxcblxuICBoYXNVcmw6ICh0YWJJZCwgdXJsKSA9PiBnZXQoKS51cmxNYXAuZ2V0KHRhYklkKT8uaGFzKHVybCkgPz8gZmFsc2UsXG5cbiAgYWRkVXJsOiAodGFiSWQsIHVybCwgbWF4QnVja2V0U2l6ZSA9IDUwMCkgPT4ge1xuICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKGdldCgpLnVybE1hcCk7XG4gICAgbGV0IGJ1Y2tldCA9IG5leHQuZ2V0KHRhYklkKSA/PyBuZXcgU2V0PHN0cmluZz4oKTtcbiAgICBpZiAoYnVja2V0Lmhhcyh1cmwpKSByZXR1cm47XG4gICAgYnVja2V0ID0gbmV3IFNldChidWNrZXQpO1xuICAgIGJ1Y2tldC5hZGQodXJsKTtcbiAgICBpZiAoYnVja2V0LnNpemUgPj0gbWF4QnVja2V0U2l6ZSkgYnVja2V0LmNsZWFyKCk7XG4gICAgbmV4dC5zZXQodGFiSWQsIGJ1Y2tldCk7XG4gICAgc2V0KHsgdXJsTWFwOiBuZXh0IH0pO1xuICB9LFxuXG4gIGNsZWFyVGFiVXJsczogKHRhYklkKSA9PlxuICAgIHNldCgocykgPT4ge1xuICAgICAgaWYgKCFzLnVybE1hcC5oYXModGFiSWQpKSByZXR1cm4gcztcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHMudXJsTWFwKTtcbiAgICAgIG5leHQuZGVsZXRlKHRhYklkKTtcbiAgICAgIHJldHVybiB7IHVybE1hcDogbmV4dCB9O1xuICAgIH0pLFxuXG4gIHNldFJlcXVlc3RIZWFkZXJzOiAocmVxdWVzdElkLCBoZWFkZXJzKSA9PlxuICAgIHNldCgocykgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IG5ldyBNYXAocy5yZXF1ZXN0SGVhZGVycyk7XG4gICAgICBuZXh0LnNldChyZXF1ZXN0SWQsIGhlYWRlcnMpO1xuICAgICAgcmV0dXJuIHsgcmVxdWVzdEhlYWRlcnM6IG5leHQgfTtcbiAgICB9KSxcblxuICBnZXRSZXF1ZXN0SGVhZGVyczogKHJlcXVlc3RJZCkgPT4gZ2V0KCkucmVxdWVzdEhlYWRlcnMuZ2V0KHJlcXVlc3RJZCksXG5cbiAgZGVsZXRlUmVxdWVzdEhlYWRlcnM6IChyZXF1ZXN0SWQpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBpZiAoIXMucmVxdWVzdEhlYWRlcnMuaGFzKHJlcXVlc3RJZCkpIHJldHVybiBzO1xuICAgICAgY29uc3QgbmV4dCA9IG5ldyBNYXAocy5yZXF1ZXN0SGVhZGVycyk7XG4gICAgICBuZXh0LmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgICAgcmV0dXJuIHsgcmVxdWVzdEhlYWRlcnM6IG5leHQgfTtcbiAgICB9KSxcblxuICBhZGRCbGFja0xpc3Q6IChyZXF1ZXN0SWQpID0+XG4gICAgc2V0KChzKSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChzLmJsYWNrTGlzdCk7XG4gICAgICBuZXh0LmFkZChyZXF1ZXN0SWQpO1xuICAgICAgcmV0dXJuIHsgYmxhY2tMaXN0OiBuZXh0IH07XG4gICAgfSksXG5cbiAgaGFzQmxhY2tMaXN0OiAocmVxdWVzdElkKSA9PiBnZXQoKS5ibGFja0xpc3QuaGFzKHJlcXVlc3RJZCksXG5cbiAgZGVsZXRlQmxhY2tMaXN0OiAocmVxdWVzdElkKSA9PlxuICAgIHNldCgocykgPT4ge1xuICAgICAgaWYgKCFzLmJsYWNrTGlzdC5oYXMocmVxdWVzdElkKSkgcmV0dXJuIHM7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChzLmJsYWNrTGlzdCk7XG4gICAgICBuZXh0LmRlbGV0ZShyZXF1ZXN0SWQpO1xuICAgICAgcmV0dXJuIHsgYmxhY2tMaXN0OiBuZXh0IH07XG4gICAgfSksXG5cbiAgY2xlYXJBbGw6ICgpID0+XG4gICAgc2V0KHtcbiAgICAgIHVybE1hcDogbmV3IE1hcCgpLFxuICAgICAgcmVxdWVzdEhlYWRlcnM6IG5ldyBNYXAoKSxcbiAgICAgIGJsYWNrTGlzdDogbmV3IFNldCgpLFxuICAgIH0pLFxuXG4gIHNldERlYm91bmNlOiAodGltZXIsIGNvdW50ID0gMCwgdGltZSA9IDApID0+XG4gICAgc2V0KHsgZGVib3VuY2VUaW1lcjogdGltZXIsIGRlYm91bmNlQ291bnQ6IGNvdW50LCBkZWJvdW5jZVRpbWU6IHRpbWUgfSksXG5cbiAgcHJ1bmVSZXF1ZXN0SGVhZGVyczogKCkgPT5cbiAgICBzZXQoKHMpID0+IHtcbiAgICAgIGlmIChzLnJlcXVlc3RIZWFkZXJzLnNpemUgPCAxMDI0MCkgcmV0dXJuIHM7XG4gICAgICByZXR1cm4geyByZXF1ZXN0SGVhZGVyczogbmV3IE1hcCgpIH07XG4gICAgfSksXG59KSk7XG4iLCIvKipcbiAqIOWXheaOoui+heWKqeWHveaVsCAtIDE6MSDov5jljp/ljp8ganMvYmFja2dyb3VuZC5qcyDnmoTovoXliqnlh73mlbBcbiAqIC0gb3BlcmF0b3JDaGVjayAvIENoZWNrRXh0ZW5zaW9uIC8gQ2hlY2tUeXBlXG4gKiAtIGZpbGVOYW1lUGFyc2UgLyBnZXRSZXNwb25zZUhlYWRlcnNWYWx1ZSAvIGdldFJlcXVlc3RIZWFkZXJzXG4gKiAtIFNldEljb24gLyBtb2JpbGVVc2VyQWdlbnQgLyBpc1NwZWNpYWxQYWdlIC8gY2xlYXJSZWR1bmRhbnRcbiAqL1xuaW1wb3J0IHsgdXNlU2V0dGluZ3NTdG9yZSB9IGZyb20gJ0BzdG9yZXMvc2V0dGluZ3MnO1xuaW1wb3J0IHsgdXNlTWVkaWFTdG9yZSB9IGZyb20gJ0BzdG9yZXMvbWVkaWEnO1xuaW1wb3J0IHsgdXNlUnVudGltZVN0b3JlIH0gZnJvbSAnQHN0b3Jlcy9ydW50aW1lJztcbmltcG9ydCB0eXBlIHsgT3BlcmF0b3IgfSBmcm9tICdAbGliL2NvbmZpZyc7XG5cbmNvbnN0IHJlRmlsZW5hbWUgPSAvZmlsZW5hbWU9XCI/KFteXCJdKylcIj8vO1xuXG4vKiog5pON5L2c56ym5qOA5p+lKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA4NDUtODczIOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBvcGVyYXRvckNoZWNrKFxuICBzaXplOiBudW1iZXIgfCB1bmRlZmluZWQsXG4gIG9iajoge1xuICAgIG9wZXJhdG9yOiBPcGVyYXRvcjtcbiAgICBzaXplOiBudW1iZXIgfCBzdHJpbmc7XG4gICAgdW5pdD86IHN0cmluZztcbiAgICBtaW4/OiBudW1iZXI7XG4gICAgbWF4PzogbnVtYmVyO1xuICB9LFxuKTogYm9vbGVhbiB7XG4gIGNvbnN0IHVuaXROdW1iZXI6IFJlY29yZDxzdHJpbmcsIG51bWJlcj4gPSB7XG4gICAgQjogMSxcbiAgICBCWVRFOiAxLFxuICAgIEtCOiAxMDI0LFxuICAgIE1COiAxMDQ4NTc2LFxuICAgIEdCOiAxMDczNzQxODI0LFxuICB9O1xuICBjb25zdCB1bml0ID0gb2JqLnVuaXQgfHwgJ0InO1xuICBjb25zdCBmYWN0b3IgPSB1bml0TnVtYmVyW3VuaXRdID8/IDE7XG4gIGNvbnN0IHRhcmdldFNpemUgPSBOdW1iZXIob2JqLnNpemUpICogZmFjdG9yO1xuICBzd2l0Y2ggKG9iai5vcGVyYXRvcikge1xuICAgIGNhc2UgJz0nOlxuICAgICAgcmV0dXJuIHNpemUgPT09IHRhcmdldFNpemU7XG4gICAgY2FzZSAnPCc6XG4gICAgICByZXR1cm4gKHNpemUgPz8gMCkgPCB0YXJnZXRTaXplO1xuICAgIGNhc2UgJz4nOlxuICAgICAgcmV0dXJuIChzaXplID8/IDApID4gdGFyZ2V0U2l6ZTtcbiAgICBjYXNlICc8PSc6XG4gICAgICByZXR1cm4gKHNpemUgPz8gMCkgPD0gdGFyZ2V0U2l6ZTtcbiAgICBjYXNlICc+PSc6XG4gICAgICByZXR1cm4gKHNpemUgPz8gMCkgPj0gdGFyZ2V0U2l6ZTtcbiAgICBjYXNlICchPSc6XG4gICAgICByZXR1cm4gc2l6ZSAhPT0gdGFyZ2V0U2l6ZTtcbiAgICBjYXNlICd+JzpcbiAgICAgIHJldHVybiAoXG4gICAgICAgIChvYmoubWluID8gKHNpemUgPz8gMCkgPj0gb2JqLm1pbiAqIGZhY3RvciA6IHRydWUpICYmXG4gICAgICAgIChvYmoubWF4ID8gKHNpemUgPz8gMCkgPD0gb2JqLm1heCAqIGZhY3RvciA6IHRydWUpXG4gICAgICApO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gKHNpemUgPz8gMCkgPD0gdGFyZ2V0U2l6ZTtcbiAgfVxufVxuXG4vKiog5qOA5p+l5omp5bGV5ZCN5ZKM5aSn5bCPKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA4ODEtODg5IOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBDaGVja0V4dGVuc2lvbihcbiAgZXh0OiBzdHJpbmcsXG4gIHNpemU6IG51bWJlciB8IHVuZGVmaW5lZCxcbik6IGJvb2xlYW4gfCAnYnJlYWsnIHtcbiAgY29uc3QgRyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKTtcbiAgY29uc3QgcnVsZSA9IEcuRXh0LmdldChleHQpO1xuICBpZiAoIXJ1bGUpIHJldHVybiBmYWxzZTtcbiAgaWYgKCFydWxlLnN0YXRlKSByZXR1cm4gJ2JyZWFrJztcbiAgaWYgKHJ1bGUuc2l6ZSAhPT0gMCAmJiBzaXplICE9PSB1bmRlZmluZWQgJiYgIW9wZXJhdG9yQ2hlY2soc2l6ZSwgcnVsZSkpIHtcbiAgICByZXR1cm4gJ2JyZWFrJztcbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqIOajgOafpeexu+Wei+WSjOWkp+Wwjyjov5jljp8gYmFja2dyb3VuZC5qcyDnrKwgODk3LTkwNSDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gQ2hlY2tUeXBlKFxuICBkYXRhVHlwZTogc3RyaW5nLFxuICBkYXRhU2l6ZTogbnVtYmVyIHwgdW5kZWZpbmVkLFxuKTogYm9vbGVhbiB8ICdicmVhaycge1xuICBjb25zdCBHID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICBjb25zdCB0eXBlSW5mbyA9XG4gICAgRy5UeXBlLmdldChkYXRhVHlwZS5zcGxpdCgnLycpWzBdICsgJy8qJykgfHwgRy5UeXBlLmdldChkYXRhVHlwZSk7XG4gIGlmICghdHlwZUluZm8pIHJldHVybiBmYWxzZTtcbiAgaWYgKCF0eXBlSW5mby5zdGF0ZSkgcmV0dXJuICdicmVhayc7XG4gIGlmICh0eXBlSW5mby5zaXplICE9PSAwICYmIGRhdGFTaXplICE9PSB1bmRlZmluZWQgJiYgIW9wZXJhdG9yQ2hlY2soZGF0YVNpemUsIHR5cGVJbmZvKSkge1xuICAgIHJldHVybiAnYnJlYWsnO1xuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG4vKiog6I635Y+W5paH5Lu25ZCN5Y+K5omp5bGV5ZCNKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA5MTItOTE3IOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBmaWxlTmFtZVBhcnNlKHBhdGhuYW1lOiBzdHJpbmcpOiBbc3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWRdIHtcbiAgbGV0IGZpbGVOYW1lID0gJyc7XG4gIHRyeSB7XG4gICAgZmlsZU5hbWUgPSBkZWNvZGVVUkkocGF0aG5hbWUuc3BsaXQoJy8nKS5wb3AoKSB8fCAnJyk7XG4gIH0gY2F0Y2gge1xuICAgIGZpbGVOYW1lID0gcGF0aG5hbWUuc3BsaXQoJy8nKS5wb3AoKSB8fCAnJztcbiAgfVxuICBjb25zdCBwYXJ0cyA9IGZpbGVOYW1lLnNwbGl0KCcuJyk7XG4gIGNvbnN0IGV4dCA9IHBhcnRzLmxlbmd0aCA9PT0gMSA/IHVuZGVmaW5lZCA6IHBhcnRzLnBvcCgpIS50b0xvd2VyQ2FzZSgpO1xuICByZXR1cm4gW2ZpbGVOYW1lLCBleHRdO1xufVxuXG5pbnRlcmZhY2UgUmVzcG9uc2VIZWFkZXJJbmZvIHtcbiAgc2l6ZT86IG51bWJlcjtcbiAgdHlwZT86IHN0cmluZztcbiAgYXR0YWNobWVudD86IHN0cmluZztcbn1cblxuLyoqIOiOt+WPluWTjeW6lOWktOS/oeaBryjov5jljp8gYmFja2dyb3VuZC5qcyDnrKwgOTI0LTk0MyDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmVzcG9uc2VIZWFkZXJzVmFsdWUoXG4gIGRhdGE6IGNocm9tZS53ZWJSZXF1ZXN0LldlYlJlc3BvbnNlSGVhZGVyc0RldGFpbHMsXG4pOiBSZXNwb25zZUhlYWRlckluZm8ge1xuICBjb25zdCBoZWFkZXI6IFJlc3BvbnNlSGVhZGVySW5mbyA9IHt9O1xuICBpZiAoIWRhdGEucmVzcG9uc2VIZWFkZXJzIHx8IGRhdGEucmVzcG9uc2VIZWFkZXJzLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGhlYWRlcjtcbiAgZm9yIChjb25zdCBpdGVtIG9mIGRhdGEucmVzcG9uc2VIZWFkZXJzKSB7XG4gICAgY29uc3QgbmFtZSA9IGl0ZW0ubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgIGlmIChuYW1lID09PSAnY29udGVudC1sZW5ndGgnKSB7XG4gICAgICBpZiAoaGVhZGVyLnNpemUgPT09IHVuZGVmaW5lZCkgaGVhZGVyLnNpemUgPSBwYXJzZUludChpdGVtLnZhbHVlID8/ICcwJywgMTApO1xuICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ2NvbnRlbnQtdHlwZScpIHtcbiAgICAgIGhlYWRlci50eXBlID0gKChpdGVtLnZhbHVlID8/ICcnKS5zcGxpdCgnOycpWzBdID8/ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIH0gZWxzZSBpZiAobmFtZSA9PT0gJ2NvbnRlbnQtZGlzcG9zaXRpb24nKSB7XG4gICAgICBoZWFkZXIuYXR0YWNobWVudCA9IGl0ZW0udmFsdWU7XG4gICAgfSBlbHNlIGlmIChuYW1lID09PSAnY29udGVudC1yYW5nZScpIHtcbiAgICAgIGNvbnN0IHNpemUgPSAoaXRlbS52YWx1ZSA/PyAnJykuc3BsaXQoJy8nKVsxXTtcbiAgICAgIGlmIChzaXplICE9PSAnKicgJiYgc2l6ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGhlYWRlci5zaXplID0gcGFyc2VJbnQoc2l6ZSwgMTApO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gaGVhZGVyO1xufVxuXG4vKiog55u05o6l5YyF5ZCr55qE6K+35rGC5aS05ZCNKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA5NTAtOTYzIOihjCkgKi9cbmNvbnN0IERJUkVDVF9JTkNMVURFX0hFQURFUlMgPSBuZXcgU2V0KFtcbiAgJ3JlZmVyZXInLCAnb3JpZ2luJywgJ2Nvb2tpZScsICdhdXRob3JpemF0aW9uJywgJ2F1dGgnLCAndG9rZW4nLCAna2V5JyxcbiAgJ2FjY2Vzcy10b2tlbicsICdhcGkta2V5JywgJ2FwcC10b2tlbicsICdhdXRodG9rZW4nLCAnc2Vzc2lvbi1pZCcsXG5dKTtcbmNvbnN0IFhfQVVUSF9LRVlXT1JEX1JFRyA9IC8oYXV0aHx0b2tlbnxzaWdufGtleXx0aWNrZXR8c2Vzc2lvbikvO1xuXG4vKiog6I635Y+W6K+35rGC5aS0KOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA5NjUtOTgyIOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRSZXF1ZXN0SGVhZGVycyhcbiAgZGF0YTogeyBhbGxSZXF1ZXN0SGVhZGVycz86IEFycmF5PHsgbmFtZTogc3RyaW5nOyB2YWx1ZT86IHN0cmluZyB9PiB8IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfSxcbik6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBmYWxzZSB7XG4gIGlmICghZGF0YT8uYWxsUmVxdWVzdEhlYWRlcnMpIHJldHVybiBmYWxzZTtcbiAgY29uc3QgaGVhZGVyOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gIGlmIChBcnJheS5pc0FycmF5KGRhdGEuYWxsUmVxdWVzdEhlYWRlcnMpKSB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIGRhdGEuYWxsUmVxdWVzdEhlYWRlcnMpIHtcbiAgICAgIGlmICghaXRlbS5uYW1lIHx8ICFpdGVtLnZhbHVlKSBjb250aW51ZTtcbiAgICAgIGNvbnN0IGxvd2VyTmFtZSA9IGl0ZW0ubmFtZS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKERJUkVDVF9JTkNMVURFX0hFQURFUlMuaGFzKGxvd2VyTmFtZSkpIHtcbiAgICAgICAgaGVhZGVyW2xvd2VyTmFtZV0gPSBpdGVtLnZhbHVlO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmIChsb3dlck5hbWUuc3RhcnRzV2l0aCgneC0nKSAmJiBYX0FVVEhfS0VZV09SRF9SRUcudGVzdChsb3dlck5hbWUpKSB7XG4gICAgICAgIGhlYWRlcltsb3dlck5hbWVdID0gaXRlbS52YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZm9yIChjb25zdCBbbmFtZSwgdmFsdWVdIG9mIE9iamVjdC5lbnRyaWVzKGRhdGEuYWxsUmVxdWVzdEhlYWRlcnMpKSB7XG4gICAgICBjb25zdCBsb3dlck5hbWUgPSBuYW1lLnRvTG93ZXJDYXNlKCk7XG4gICAgICBpZiAoXG4gICAgICAgIERJUkVDVF9JTkNMVURFX0hFQURFUlMuaGFzKGxvd2VyTmFtZSkgfHxcbiAgICAgICAgKGxvd2VyTmFtZS5zdGFydHNXaXRoKCd4LScpICYmIFhfQVVUSF9LRVlXT1JEX1JFRy50ZXN0KGxvd2VyTmFtZSkpXG4gICAgICApIHtcbiAgICAgICAgaGVhZGVyW2xvd2VyTmFtZV0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcmV0dXJuIE9iamVjdC5rZXlzKGhlYWRlcikubGVuZ3RoID4gMCA/IGhlYWRlciA6IGZhbHNlO1xufVxuXG4vKiog6Kej5p6QIGNvbnRlbnQtZGlzcG9zaXRpb24o6L+Y5Y6fIGJhY2tncm91bmQuanMg56ysIDE4Mi0xODgg6KGM55qE6ZmE5Lu26YC76L6RKSAqL1xuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlQXR0YWNobWVudEZpbGVuYW1lKGF0dGFjaG1lbnQ6IHN0cmluZyk6IFtzdHJpbmcsIHN0cmluZyB8IHVuZGVmaW5lZF0gfCBudWxsIHtcbiAgY29uc3QgbWF0Y2ggPSByZUZpbGVuYW1lLmV4ZWMoYXR0YWNobWVudCk7XG4gIGlmICghbWF0Y2ggfHwgIW1hdGNoWzFdKSByZXR1cm4gbnVsbDtcbiAgbGV0IGRlY29kZWQgPSAnJztcbiAgdHJ5IHtcbiAgICBkZWNvZGVkID0gZGVjb2RlVVJJQ29tcG9uZW50KG1hdGNoWzFdKTtcbiAgfSBjYXRjaCB7XG4gICAgZGVjb2RlZCA9IG1hdGNoWzFdO1xuICB9XG4gIHJldHVybiBmaWxlTmFtZVBhcnNlKGRlY29kZWQpO1xufVxuXG4vKiog6K6+572u5omp5bGV5Zu+5qCH5b6956ugKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA5ODQtOTkzIOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBTZXRJY29uKG9iaj86IHsgbnVtYmVyPzogbnVtYmVyOyB0YWJJZD86IG51bWJlciB9KTogdm9pZCB7XG4gIGNvbnN0IEcgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCk7XG4gIGNvbnN0IHRhYklkID0gb2JqPy50YWJJZCA/PyBHLnRhYklkO1xuICBpZiAoIW9iaiB8fCBvYmoubnVtYmVyID09PSAwIHx8IG9iai5udW1iZXIgPT09IHVuZGVmaW5lZCkge1xuICAgIGNocm9tZS5hY3Rpb24uc2V0QmFkZ2VUZXh0KHsgdGV4dDogJycsIHRhYklkIH0pO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoRy5vcHRpb25zLmJhZGdlTnVtYmVyKSB7XG4gICAgY29uc3QgdGV4dCA9IG9iai5udW1iZXIgPiA5OTkgPyAnOTk5KycgOiBTdHJpbmcob2JqLm51bWJlcik7XG4gICAgY2hyb21lLmFjdGlvbi5zZXRCYWRnZVRleHQoeyB0ZXh0LCB0YWJJZCB9KTtcbiAgfVxufVxuXG4vKiog5qih5ouf5omL5py656uvIFVBKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA5OTYtMTAyNCDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gbW9iaWxlVXNlckFnZW50KHRhYklkOiBudW1iZXIsIGNoYW5nZSA9IGZhbHNlKTogdm9pZCB7XG4gIGNvbnN0IHNldHRpbmdzID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICBjb25zdCBhcmVhID0gY2hyb21lLnN0b3JhZ2Uuc2Vzc2lvbiA/PyBjaHJvbWUuc3RvcmFnZS5sb2NhbDtcbiAgaWYgKGNoYW5nZSkge1xuICAgIHNldHRpbmdzLmFkZEZlYXRNb2JpbGVUYWIodGFiSWQpO1xuICAgIGNvbnN0IG5leHRTZXQgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCkuZmVhdE1vYmlsZVRhYklkO1xuICAgIHZvaWQgYXJlYS5zZXQoeyBmZWF0TW9iaWxlVGFiSWQ6IEFycmF5LmZyb20obmV4dFNldCkgfSk7XG4gICAgY2hyb21lLmRlY2xhcmF0aXZlTmV0UmVxdWVzdC51cGRhdGVTZXNzaW9uUnVsZXMoe1xuICAgICAgcmVtb3ZlUnVsZUlkczogW3RhYklkXSxcbiAgICAgIGFkZFJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogdGFiSWQsXG4gICAgICAgICAgYWN0aW9uOiB7XG4gICAgICAgICAgICB0eXBlOiAnbW9kaWZ5SGVhZGVycycgYXMgY2hyb21lLmRlY2xhcmF0aXZlTmV0UmVxdWVzdC5SdWxlQWN0aW9uVHlwZSxcbiAgICAgICAgICAgIHJlcXVlc3RIZWFkZXJzOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBoZWFkZXI6ICdVc2VyLUFnZW50JyxcbiAgICAgICAgICAgICAgICBvcGVyYXRpb246ICdzZXQnIGFzIGNocm9tZS5kZWNsYXJhdGl2ZU5ldFJlcXVlc3QuSGVhZGVyT3BlcmF0aW9uLFxuICAgICAgICAgICAgICAgIHZhbHVlOiBzZXR0aW5ncy5vcHRpb25zLk1vYmlsZVVzZXJBZ2VudCxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBjb25kaXRpb246IHtcbiAgICAgICAgICAgIHRhYklkczogW3RhYklkXSxcbiAgICAgICAgICAgIHJlc291cmNlVHlwZXM6IE9iamVjdC52YWx1ZXMoXG4gICAgICAgICAgICAgIGNocm9tZS5kZWNsYXJhdGl2ZU5ldFJlcXVlc3QuUmVzb3VyY2VUeXBlLFxuICAgICAgICAgICAgKSBhcyBjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LlJlc291cmNlVHlwZVtdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuICAgIHJldHVybjtcbiAgfVxuICBzZXR0aW5ncy5yZW1vdmVGZWF0TW9iaWxlVGFiKHRhYklkKTtcbiAgY29uc3QgbmV4dFNldCA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKS5mZWF0TW9iaWxlVGFiSWQ7XG4gIHZvaWQgYXJlYS5zZXQoeyBmZWF0TW9iaWxlVGFiSWQ6IEFycmF5LmZyb20obmV4dFNldCkgfSk7XG4gIGNocm9tZS5kZWNsYXJhdGl2ZU5ldFJlcXVlc3QudXBkYXRlU2Vzc2lvblJ1bGVzKHsgcmVtb3ZlUnVsZUlkczogW3RhYklkXSB9KTtcbn1cblxuLyoqIOWIpOaWreeJueauiumhtemdoijov5jljp8gYmFja2dyb3VuZC5qcyDnrKwgMTAyNy0xMDMwIOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBpc1NwZWNpYWxQYWdlKHVybD86IHN0cmluZyk6IGJvb2xlYW4ge1xuICBpZiAoIXVybCB8fCB1cmwgPT09ICdudWxsJykgcmV0dXJuIHRydWU7XG4gIHJldHVybiAhKFxuICAgIHVybC5zdGFydHNXaXRoKCdodHRwOi8vJykgfHxcbiAgICB1cmwuc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSB8fFxuICAgIHVybC5zdGFydHNXaXRoKCdibG9iOicpXG4gICk7XG59XG5cbi8qKiDmuIXnkIblhpfkvZnmlbDmja4o6L+Y5Y6fIGJhY2tncm91bmQuanMg56ysIDEwMzUtMTEwNCDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gY2xlYXJSZWR1bmRhbnQoKTogdm9pZCB7XG4gIGNvbnN0IEcgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCk7XG4gIGNocm9tZS50YWJzLnF1ZXJ5KHt9LCAodGFicykgPT4ge1xuICAgIGNvbnN0IGFsbFRhYklkID0gbmV3IFNldCh0YWJzLm1hcCgodCkgPT4gdC5pZCkpO1xuICAgIGNvbnN0IG1lZGlhID0gdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpO1xuICAgIGNvbnN0IHJ1bnRpbWUgPSB1c2VSdW50aW1lU3RvcmUuZ2V0U3RhdGUoKTtcblxuICAgIC8vIDEuIOa4heeQhiBjYWNoZURhdGEg5Lit5bey5YWz6ZetIHRhYiDnmoTmlbDmja5cbiAgICBsZXQgY2FjaGVDaGFuZ2VkID0gZmFsc2U7XG4gICAgY29uc3QgbmV4dEJ1Y2tldHMgPSBuZXcgTWFwKG1lZGlhLmJ1Y2tldHMpO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIG5leHRCdWNrZXRzLmtleXMoKSkge1xuICAgICAgaWYgKCFhbGxUYWJJZC5oYXMoa2V5KSkge1xuICAgICAgICBuZXh0QnVja2V0cy5kZWxldGUoa2V5KTtcbiAgICAgICAgY2FjaGVDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKGNhY2hlQ2hhbmdlZCkge1xuICAgICAgdXNlTWVkaWFTdG9yZS5zZXRTdGF0ZSh7IGJ1Y2tldHM6IG5leHRCdWNrZXRzIH0pO1xuICAgICAgdm9pZCBtZWRpYS5wZXJzaXN0KCk7XG4gICAgfVxuXG4gICAgLy8gMi4g5riF55CGIHVybE1hcFxuICAgIGNvbnN0IG5leHRVcmxNYXAgPSBuZXcgTWFwKHJ1bnRpbWUudXJsTWFwKTtcbiAgICBsZXQgdXJsTWFwQ2hhbmdlZCA9IGZhbHNlO1xuICAgIGZvciAoY29uc3Qga2V5IG9mIG5leHRVcmxNYXAua2V5cygpKSB7XG4gICAgICBpZiAoIWFsbFRhYklkLmhhcyhrZXkpKSB7XG4gICAgICAgIG5leHRVcmxNYXAuZGVsZXRlKGtleSk7XG4gICAgICAgIHVybE1hcENoYW5nZWQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodXJsTWFwQ2hhbmdlZCkgdXNlUnVudGltZVN0b3JlLnNldFN0YXRlKHsgdXJsTWFwOiBuZXh0VXJsTWFwIH0pO1xuXG4gICAgLy8gMy4g5riF55CG6ISa5pysXG4gICAgY29uc3QgbmV4dFNjcmlwdExpc3QgPSBuZXcgTWFwKEcuc2NyaXB0TGlzdCk7XG4gICAgbGV0IHNjcmlwdENoYW5nZWQgPSBmYWxzZTtcbiAgICBmb3IgKGNvbnN0IFtuYW1lLCBlbnRyeV0gb2YgbmV4dFNjcmlwdExpc3QpIHtcbiAgICAgIGNvbnN0IG5leHRUYWJJZCA9IG5ldyBTZXQoZW50cnkudGFiSWQpO1xuICAgICAgbGV0IGVudHJ5Q2hhbmdlZCA9IGZhbHNlO1xuICAgICAgZm9yIChjb25zdCB0aWQgb2YgZW50cnkudGFiSWQpIHtcbiAgICAgICAgaWYgKCFhbGxUYWJJZC5oYXModGlkKSkge1xuICAgICAgICAgIG5leHRUYWJJZC5kZWxldGUodGlkKTtcbiAgICAgICAgICBlbnRyeUNoYW5nZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoZW50cnlDaGFuZ2VkKSB7XG4gICAgICAgIG5leHRTY3JpcHRMaXN0LnNldChuYW1lLCB7IC4uLmVudHJ5LCB0YWJJZDogbmV4dFRhYklkIH0pO1xuICAgICAgICBzY3JpcHRDaGFuZ2VkID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHNjcmlwdENoYW5nZWQpIHVzZVNldHRpbmdzU3RvcmUuc2V0U3RhdGUoeyBzY3JpcHRMaXN0OiBuZXh0U2NyaXB0TGlzdCB9KTtcblxuICAgIGlmICghRy5pbml0TG9jYWxDb21wbGV0ZSkgcmV0dXJuO1xuXG4gICAgLy8gNC4g5riF55CGIGRlY2xhcmF0aXZlTmV0UmVxdWVzdCjmqKHmi5/miYvmnLopXG4gICAgY2hyb21lLmRlY2xhcmF0aXZlTmV0UmVxdWVzdC5nZXRTZXNzaW9uUnVsZXMoKHJ1bGVzKSA9PiB7XG4gICAgICBsZXQgbW9iaWxlRmxhZyA9IGZhbHNlO1xuICAgICAgY29uc3QgdGFic1RvUmVtb3ZlOiBudW1iZXJbXSA9IFtdO1xuICAgICAgZm9yIChjb25zdCBpdGVtIG9mIHJ1bGVzKSB7XG4gICAgICAgIGlmIChpdGVtLmNvbmRpdGlvbi50YWJJZHMpIHtcbiAgICAgICAgICBpZiAoIWl0ZW0uY29uZGl0aW9uLnRhYklkcy5zb21lKChpZDogbnVtYmVyKSA9PiBhbGxUYWJJZC5oYXMoaWQpKSkge1xuICAgICAgICAgICAgbW9iaWxlRmxhZyA9IHRydWU7XG4gICAgICAgICAgICBpdGVtLmNvbmRpdGlvbi50YWJJZHMuZm9yRWFjaCgoaWQ6IG51bWJlcikgPT4gdGFic1RvUmVtb3ZlLnB1c2goaWQpKTtcbiAgICAgICAgICAgIGNocm9tZS5kZWNsYXJhdGl2ZU5ldFJlcXVlc3QudXBkYXRlU2Vzc2lvblJ1bGVzKHtcbiAgICAgICAgICAgICAgcmVtb3ZlUnVsZUlkczogW2l0ZW0uaWRdLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2UgaWYgKGl0ZW0uaWQgPT09IDEpIHtcbiAgICAgICAgICBjaHJvbWUuZGVjbGFyYXRpdmVOZXRSZXF1ZXN0LnVwZGF0ZVNlc3Npb25SdWxlcyh7IHJlbW92ZVJ1bGVJZHM6IFsxXSB9KTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKG1vYmlsZUZsYWcpIHtcbiAgICAgICAgY29uc3Qgc2V0dGluZ3MgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCk7XG4gICAgICAgIGNvbnN0IG5leHRNb2JpbGUgPSBuZXcgU2V0KHNldHRpbmdzLmZlYXRNb2JpbGVUYWJJZCk7XG4gICAgICAgIGZvciAoY29uc3QgaWQgb2YgdGFic1RvUmVtb3ZlKSBuZXh0TW9iaWxlLmRlbGV0ZShpZCk7XG4gICAgICAgIHVzZVNldHRpbmdzU3RvcmUuc2V0U3RhdGUoeyBmZWF0TW9iaWxlVGFiSWQ6IG5leHRNb2JpbGUgfSk7XG4gICAgICAgIGNvbnN0IGFyZWEgPSBjaHJvbWUuc3RvcmFnZS5zZXNzaW9uID8/IGNocm9tZS5zdG9yYWdlLmxvY2FsO1xuICAgICAgICB2b2lkIGFyZWEuc2V0KHsgZmVhdE1vYmlsZVRhYklkOiBBcnJheS5mcm9tKG5leHRNb2JpbGUpIH0pO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gNS4g5riF55CG6Ieq5Yqo5LiL6L29XG4gICAgbGV0IGF1dG9Eb3duRmxhZyA9IGZhbHNlO1xuICAgIGNvbnN0IG5leHRBdXRvID0gbmV3IFNldChHLmZlYXRBdXRvRG93blRhYklkKTtcbiAgICBmb3IgKGNvbnN0IHRpZCBvZiBHLmZlYXRBdXRvRG93blRhYklkKSB7XG4gICAgICBpZiAoIWFsbFRhYklkLmhhcyh0aWQpKSB7XG4gICAgICAgIG5leHRBdXRvLmRlbGV0ZSh0aWQpO1xuICAgICAgICBhdXRvRG93bkZsYWcgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoYXV0b0Rvd25GbGFnKSB7XG4gICAgICB1c2VTZXR0aW5nc1N0b3JlLnNldFN0YXRlKHsgZmVhdEF1dG9Eb3duVGFiSWQ6IG5leHRBdXRvIH0pO1xuICAgICAgY29uc3QgYXJlYSA9IGNocm9tZS5zdG9yYWdlLnNlc3Npb24gPz8gY2hyb21lLnN0b3JhZ2UubG9jYWw7XG4gICAgICB2b2lkIGFyZWEuc2V0KHsgZmVhdEF1dG9Eb3duVGFiSWQ6IEFycmF5LmZyb20obmV4dEF1dG8pIH0pO1xuICAgIH1cblxuICAgIC8vIDYuIOa4heeQhiBibG9ja1VybFNldCAvIGRhbW5VcmxTZXRcbiAgICBjb25zdCBuZXh0QmxvY2sgPSBuZXcgU2V0KFsuLi5HLmJsb2NrVXJsU2V0XS5maWx0ZXIoKHgpID0+IGFsbFRhYklkLmhhcyh4KSkpO1xuICAgIGNvbnN0IG5leHREYW1uID0gbmV3IFNldChbLi4uRy5kYW1uVXJsU2V0XS5maWx0ZXIoKHgpID0+IGFsbFRhYklkLmhhcyh4KSkpO1xuICAgIHVzZVNldHRpbmdzU3RvcmUuc2V0U3RhdGUoe1xuICAgICAgYmxvY2tVcmxTZXQ6IG5leHRCbG9jayxcbiAgICAgIGRhbW5VcmxTZXQ6IG5leHREYW1uLFxuICAgIH0pO1xuXG4gICAgLy8gNy4gcmVxdWVzdEhlYWRlcnMg6L+H5aSn5pe25riF55CGXG4gICAgaWYgKHJ1bnRpbWUucmVxdWVzdEhlYWRlcnMuc2l6ZSA+PSAxMDI0MCkge1xuICAgICAgcnVudGltZS5yZXF1ZXN0SGVhZGVycy5jbGVhcigpO1xuICAgIH1cbiAgfSk7XG59XG4iLCIvKipcbiAqIOaooeadv+W8leaTjiAtIDE6MSDov5jljp/ljp8ganMvdGVtcGxhdGVzLmpzIOeahCBUZW1wbGF0ZSDnsbtcbiAqIOaUr+aMgSAke3Zhcn0g5Y2g5L2N56ymICsg566h6YGT5aSE55CG5ZmoKHNsaWNlfHJlcGxhY2V8cmVnZXhwfGV4aXN0c3x0b3xmaW5kfGZpbHRlcnxwcm9tcHQpXG4gKi9cbmltcG9ydCB7IGlzRW1wdHksIHN0cmluZ01vZGlmeSwgYXBwZW5kWmVybyB9IGZyb20gJy4vZnVuY3Rpb24nO1xuXG5leHBvcnQgaW50ZXJmYWNlIFRlbXBsYXRlQ29udGV4dCB7XG4gIHVybD86IHN0cmluZztcbiAgcmVmZXJlcj86IHN0cmluZztcbiAgb3JpZ2luPzogc3RyaW5nO1xuICBpbml0aWF0b3I/OiBzdHJpbmc7XG4gIHdlYlVybD86IHN0cmluZztcbiAgdGl0bGU/OiBzdHJpbmc7XG4gIF90aXRsZT86IHN0cmluZztcbiAgY29va2llPzogc3RyaW5nO1xuICB0YWJJZD86IG51bWJlcjtcbiAgcGFnZURPTT86IERvY3VtZW50O1xuICBmdWxsRmlsZU5hbWU/OiBzdHJpbmc7XG4gIGZpbGVOYW1lPzogc3RyaW5nO1xuICBleHQ/OiBzdHJpbmc7XG4gIG1vYmlsZVVzZXJBZ2VudD86IHN0cmluZztcbiAgdXNlckFnZW50Pzogc3RyaW5nO1xuICByZXF1ZXN0SGVhZGVycz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz47XG4gIFtrZXk6IHN0cmluZ106IHVua25vd247XG59XG5cbnR5cGUgUHJvY2Vzc29yID0gKFxuICB0eHQ6IHN0cmluZyxcbiAgYXJnOiB1bmtub3duW10sXG4gIGRhdGE6IFRlbXBsYXRlQ29udGV4dCxcbikgPT4gc3RyaW5nO1xuXG5leHBvcnQgY2xhc3MgVGVtcGxhdGUge1xuICBzdGF0aWMgX3Byb2Nlc3NvcnM6IFJlY29yZDxzdHJpbmcsIFByb2Nlc3Nvcj4gPSB7XG4gICAgc2xpY2U6ICh0eHQsIGFyZykgPT4gdHh0LnNsaWNlKC4uLihhcmcgYXMgW251bWJlciwgbnVtYmVyP10pKSxcbiAgICByZXBsYWNlOiAodHh0LCBhcmcpID0+XG4gICAgICB0eHQucmVwbGFjZSguLi4oYXJnIGFzIFtzdHJpbmcgfCBSZWdFeHAsIHN0cmluZ10pKSxcbiAgICByZXBsYWNlQWxsOiAodHh0LCBhcmcpID0+XG4gICAgICB0eHQucmVwbGFjZUFsbCguLi4oYXJnIGFzIFtzdHJpbmcsIHN0cmluZ10pKSxcbiAgICByZWdleHA6ICh0eHQsIGFyZykgPT4ge1xuICAgICAgY29uc3QgbWF0Y2ggPSB0eHQubWF0Y2gobmV3IFJlZ0V4cCguLi4oYXJnIGFzIFtzdHJpbmcsIHN0cmluZz9dKSkpO1xuICAgICAgaWYgKCFtYXRjaCkgcmV0dXJuICcnO1xuICAgICAgcmV0dXJuIG1hdGNoLnNsaWNlKDEpLmZpbHRlcihCb29sZWFuKS5tYXAoKHMpID0+IHMudHJpbSgpKS5qb2luKCcnKTtcbiAgICB9LFxuICAgIGV4aXN0czogKHR4dCwgYXJnKSA9PiB7XG4gICAgICBjb25zdCBhID0gYXJnIGFzIHN0cmluZ1tdO1xuICAgICAgcmV0dXJuIHR4dCA/IChhWzBdPy5yZXBsYWNlQWxsKCcqJywgdHh0KSA/PyAnJykgOiAoYVsxXT8ucmVwbGFjZUFsbCgnKicsIHR4dCkgPz8gJycpO1xuICAgIH0sXG4gICAgcHJlcGVuZDogKHR4dCwgYXJnKSA9PiAoKGFyZ1swXSBhcyBzdHJpbmcpIHx8ICcnKSArIHR4dCxcbiAgICBjb25jYXQ6ICh0eHQsIGFyZykgPT4gdHh0ICsgKChhcmdbMF0gYXMgc3RyaW5nKSB8fCAnJyksXG4gICAgdG86ICh0eHQsIGFyZykgPT4ge1xuICAgICAgY29uc3QgdHlwZSA9IGFyZ1swXSBhcyBzdHJpbmc7XG4gICAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgICAgY2FzZSAnYmFzZTY0JzpcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIGJ0b2EoXG4gICAgICAgICAgICAgIGVuY29kZVVSSUNvbXBvbmVudCh0eHQpLnJlcGxhY2UoXG4gICAgICAgICAgICAgICAgLyUoWzAtOUEtRl17Mn0pL2csXG4gICAgICAgICAgICAgICAgKF8sIHAxKSA9PiBTdHJpbmcuZnJvbUNoYXJDb2RlKHBhcnNlSW50KHAxLCAxNikpLFxuICAgICAgICAgICAgICApLFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgIHJldHVybiB0eHQ7XG4gICAgICAgICAgfVxuICAgICAgICBjYXNlICd1cmxFbmNvZGUnOlxuICAgICAgICAgIHJldHVybiBlbmNvZGVVUklDb21wb25lbnQodHh0KTtcbiAgICAgICAgY2FzZSAndXJsRGVjb2RlJzpcbiAgICAgICAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHR4dCk7XG4gICAgICAgIGNhc2UgJ2xvd2VyQ2FzZSc6XG4gICAgICAgICAgcmV0dXJuIHR4dC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBjYXNlICd1cHBlckNhc2UnOlxuICAgICAgICAgIHJldHVybiB0eHQudG9VcHBlckNhc2UoKTtcbiAgICAgICAgY2FzZSAndHJpbSc6XG4gICAgICAgICAgcmV0dXJuIHR4dC50cmltKCk7XG4gICAgICAgIGNhc2UgJ2ZpbHRlcic6XG4gICAgICAgICAgcmV0dXJuIHN0cmluZ01vZGlmeSh0eHQudHJpbSgpKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICByZXR1cm4gdHh0O1xuICAgICAgfVxuICAgIH0sXG4gICAgZmluZDogKF90eHQsIGFyZywgZGF0YSkgPT4ge1xuICAgICAgaWYgKGRhdGE/LnBhZ2VET00gJiYgZGF0YS5wYWdlRE9NIGluc3RhbmNlb2YgRG9jdW1lbnQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gKGRhdGEucGFnZURPTS5xdWVyeVNlbGVjdG9yKGFyZ1swXSBhcyBzdHJpbmcpPy50ZXh0Q29udGVudD8udHJpbSgpID8/ICcnKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgcmV0dXJuICcnO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gJyc7XG4gICAgfSxcbiAgICBmaWx0ZXI6ICh0eHQsIGFyZykgPT4gc3RyaW5nTW9kaWZ5KHR4dCwgYXJnWzBdIGFzIHN0cmluZyksXG4gICAgcHJvbXB0OiAodHh0KSA9PiAodHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgPyB3aW5kb3cucHJvbXB0KCcnLCB0eHQpIHx8ICcnIDogdHh0KSxcbiAgfTtcblxuICBzdGF0aWMgcmVuZGVyKHRleHQ6IHVua25vd24sIGRhdGE6IFRlbXBsYXRlQ29udGV4dCk6IHN0cmluZyB7XG4gICAgaWYgKGlzRW1wdHkodGV4dCkpIHJldHVybiAnJztcblxuICAgIC8vIOihpeWFqOaWh+S7tuWQjeebuOWFs+aVsOaNrijov5jljp8gdGVtcGxhdGVzLmpzIOesrCA0Ni01MyDooYwpXG4gICAgdHJ5IHtcbiAgICAgIGRhdGEuZnVsbEZpbGVOYW1lID0gbmV3IFVSTChkYXRhLnVybCA/PyAnJykucGF0aG5hbWUuc3BsaXQoJy8nKS5wb3AoKSB8fCAnJztcbiAgICB9IGNhdGNoIHtcbiAgICAgIGRhdGEuZnVsbEZpbGVOYW1lID0gJ05VTEwnO1xuICAgIH1cbiAgICBjb25zdCBwYXJ0cyA9IGRhdGEuZnVsbEZpbGVOYW1lLnNwbGl0KCcuJyk7XG4gICAgaWYgKHBhcnRzLmxlbmd0aCA+IDEpIHBhcnRzLnBvcCgpO1xuICAgIGRhdGEuZmlsZU5hbWUgPSBwYXJ0cy5qb2luKCcuJyk7XG4gICAgaWYgKGlzRW1wdHkoZGF0YS5leHQpKSB7XG4gICAgICBjb25zdCBleHRQYXJ0cyA9IGRhdGEuZnVsbEZpbGVOYW1lLnNwbGl0KCcuJyk7XG4gICAgICBkYXRhLmV4dCA9IGV4dFBhcnRzLmxlbmd0aCA9PT0gMSA/ICcnIDogZXh0UGFydHNbZXh0UGFydHMubGVuZ3RoIC0gMV07XG4gICAgfVxuXG4gICAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKCk7XG4gICAgY29uc3QgdHJpbURhdGE6IFRlbXBsYXRlQ29udGV4dCA9IHtcbiAgICAgIHVybDogZGF0YS51cmwgPz8gJycsXG4gICAgICByZWZlcmVyOiBkYXRhLnJlcXVlc3RIZWFkZXJzPy5yZWZlcmVyID8/ICcnLFxuICAgICAgb3JpZ2luOiBkYXRhLnJlcXVlc3RIZWFkZXJzPy5vcmlnaW4gPz8gJycsXG4gICAgICBpbml0aWF0b3I6IGRhdGEucmVxdWVzdEhlYWRlcnM/LnJlZmVyZXJcbiAgICAgICAgPyBkYXRhLnJlcXVlc3RIZWFkZXJzLnJlZmVyZXJcbiAgICAgICAgOiBkYXRhLmluaXRpYXRvcixcbiAgICAgIHdlYlVybDogZGF0YS53ZWJVcmwgPz8gJycsXG4gICAgICB0aXRsZTogZGF0YS5fdGl0bGUgfHwgZGF0YS50aXRsZSB8fCAnTlVMTCcsXG4gICAgICBwYWdlRE9NOiBkYXRhLnBhZ2VET00sXG4gICAgICBjb29raWU6IGRhdGEuY29va2llID8/ICcnLFxuICAgICAgdGFiSWQ6IGRhdGEudGFiSWQgPz8gMCxcbiAgICAgIHllYXI6IGRhdGUuZ2V0RnVsbFllYXIoKSxcbiAgICAgIG1vbnRoOiBhcHBlbmRaZXJvKGRhdGUuZ2V0TW9udGgoKSArIDEpLFxuICAgICAgZGF0ZTogYXBwZW5kWmVybyhkYXRlLmdldERhdGUoKSksXG4gICAgICBkYXk6IFsnU3VuZGF5JywgJ01vbmRheScsICdUdWVzZGF5JywgJ1dlZG5lc2RheScsICdUaHVyc2RheScsICdGcmlkYXknLCAnU2F0dXJkYXknXVtkYXRlLmdldERheSgpXSxcbiAgICAgIGZ1bGxEYXRlOiBgJHtkYXRlLmdldEZ1bGxZZWFyKCl9LSR7YXBwZW5kWmVybyhkYXRlLmdldE1vbnRoKCkgKyAxKX0tJHthcHBlbmRaZXJvKGRhdGUuZ2V0RGF0ZSgpKX1gLFxuICAgICAgdGltZTogYCR7YXBwZW5kWmVybyhkYXRlLmdldEhvdXJzKCkpfScke2FwcGVuZFplcm8oZGF0ZS5nZXRNaW51dGVzKCkpfScke2FwcGVuZFplcm8oZGF0ZS5nZXRTZWNvbmRzKCkpfWAsXG4gICAgICBob3VyczogYXBwZW5kWmVybyhkYXRlLmdldEhvdXJzKCkpLFxuICAgICAgbWludXRlczogYXBwZW5kWmVybyhkYXRlLmdldE1pbnV0ZXMoKSksXG4gICAgICBzZWNvbmRzOiBhcHBlbmRaZXJvKGRhdGUuZ2V0U2Vjb25kcygpKSxcbiAgICAgIG5vdzogRGF0ZS5ub3coKSxcbiAgICAgIHRpbWVzdGFtcDogZGF0ZS50b0lTT1N0cmluZygpLFxuICAgICAgZnVsbEZpbGVOYW1lOiBkYXRhLmZ1bGxGaWxlTmFtZSxcbiAgICAgIGZpbGVOYW1lOiBkYXRhLmZpbGVOYW1lID8/ICcnLFxuICAgICAgZXh0OiBkYXRhLmV4dCA/PyAnJyxcbiAgICAgIG1vYmlsZVVzZXJBZ2VudDogZGF0YS5tb2JpbGVVc2VyQWdlbnQgPz8gJycsXG4gICAgICB1c2VyQWdlbnQ6IGRhdGEudXNlckFnZW50ID8/ICcnLFxuICAgIH07XG4gICAgdHJpbURhdGEudGl0bGUgPSBTdHJpbmcodHJpbURhdGEudGl0bGUpLnJlcGxhY2UoL1svXFxcXF0vZywgJ18nKTtcbiAgICBjb25zdCBfZGF0YTogVGVtcGxhdGVDb250ZXh0ID0geyAuLi5kYXRhLCAuLi50cmltRGF0YSB9O1xuXG4gICAgY29uc3QgYXN0ID0gdGhpcy5fcGFyc2UoU3RyaW5nKHRleHQpKTtcbiAgICByZXR1cm4gdGhpcy5fZXZhbHVhdGUoYXN0LCBfZGF0YSwgdHJpbURhdGEpO1xuICB9XG5cbiAgLy8gPT09PT09PT09PSDop6PmnpDpmLbmrrUo6L+Y5Y6fIHRlbXBsYXRlcy5qcyDnrKwgOTEtMjA2IOihjCkgPT09PT09PT09PVxuICBwcml2YXRlIHN0YXRpYyBfcGFyc2UoaW5wdXQ6IHN0cmluZykge1xuICAgIGludGVyZmFjZSBOb2RlIHtcbiAgICAgIHR5cGU6ICd0ZXh0JyB8ICd0YWcnO1xuICAgICAgdmFsdWU/OiBzdHJpbmc7XG4gICAgICB2YXJOYW1lPzogc3RyaW5nO1xuICAgICAgcGlwZXM/OiBhbnlbXTtcbiAgICB9XG4gICAgY29uc3Qgbm9kZXM6IE5vZGVbXSA9IFtdO1xuICAgIGxldCBwb3MgPSAwO1xuICAgIGNvbnN0IHBlZWsgPSAob2Zmc2V0ID0gMCkgPT5cbiAgICAgIHBvcyArIG9mZnNldCA8IGlucHV0Lmxlbmd0aCA/IGlucHV0W3BvcyArIG9mZnNldF0gOiAnJztcbiAgICBjb25zdCBhZHZhbmNlID0gKCkgPT4gKHBvcyA8IGlucHV0Lmxlbmd0aCA/IGlucHV0W3BvcysrXSA6ICcnKTtcbiAgICBjb25zdCBlb2YgPSAoKSA9PiBwb3MgPj0gaW5wdXQubGVuZ3RoO1xuXG4gICAgY29uc3QgcmVhZEJhbGFuY2VkQ29udGVudCA9ICgpID0+IHtcbiAgICAgIGxldCBkZXB0aCA9IDE7XG4gICAgICBjb25zdCBzdGFydCA9IHBvcztcbiAgICAgIGxldCBpbkRvdWJsZSA9IGZhbHNlO1xuICAgICAgbGV0IGluU2luZ2xlID0gZmFsc2U7XG4gICAgICBsZXQgZXNjYXBlZCA9IGZhbHNlO1xuICAgICAgd2hpbGUgKCFlb2YoKSAmJiBkZXB0aCA+IDApIHtcbiAgICAgICAgY29uc3QgY2ggPSBhZHZhbmNlKCk7XG4gICAgICAgIGlmIChlc2NhcGVkKSB7XG4gICAgICAgICAgZXNjYXBlZCA9IGZhbHNlO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICAgIGlmIChjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgICAgZXNjYXBlZCA9IHRydWU7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFpblNpbmdsZSAmJiBjaCA9PT0gJ1wiJykgaW5Eb3VibGUgPSAhaW5Eb3VibGU7XG4gICAgICAgIGVsc2UgaWYgKCFpbkRvdWJsZSAmJiBjaCA9PT0gXCInXCIpIGluU2luZ2xlID0gIWluU2luZ2xlO1xuICAgICAgICBlbHNlIGlmICghaW5Eb3VibGUgJiYgIWluU2luZ2xlKSB7XG4gICAgICAgICAgaWYgKGNoID09PSAnJCcgJiYgcGVlaygpID09PSAneycpIGRlcHRoKys7XG4gICAgICAgICAgZWxzZSBpZiAoY2ggPT09ICd9Jykge1xuICAgICAgICAgICAgZGVwdGgtLTtcbiAgICAgICAgICAgIGlmIChkZXB0aCA9PT0gMCkgcmV0dXJuIGlucHV0LnNsaWNlKHN0YXJ0LCBwb3MgLSAxKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHJldHVybiBpbnB1dC5zbGljZShzdGFydCwgcG9zKTtcbiAgICB9O1xuXG4gICAgY29uc3Qgc3BsaXRCeVRvcExldmVsUGlwZSA9IChzdHI6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgICBsZXQgc3RhcnQgPSAwO1xuICAgICAgbGV0IGluRG91YmxlID0gZmFsc2U7XG4gICAgICBsZXQgaW5TaW5nbGUgPSBmYWxzZTtcbiAgICAgIGxldCBlc2NhcGVkID0gZmFsc2U7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0ci5sZW5ndGg7IGkrKykge1xuICAgICAgICBjb25zdCBjaCA9IHN0cltpXTtcbiAgICAgICAgaWYgKGVzY2FwZWQpIHtcbiAgICAgICAgICBlc2NhcGVkID0gZmFsc2U7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNoID09PSAnXFxcXCcpIHtcbiAgICAgICAgICBlc2NhcGVkID0gdHJ1ZTtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIWluU2luZ2xlICYmIGNoID09PSAnXCInKSBpbkRvdWJsZSA9ICFpbkRvdWJsZTtcbiAgICAgICAgZWxzZSBpZiAoIWluRG91YmxlICYmIGNoID09PSBcIidcIikgaW5TaW5nbGUgPSAhaW5TaW5nbGU7XG4gICAgICAgIGVsc2UgaWYgKCFpbkRvdWJsZSAmJiAhaW5TaW5nbGUgJiYgY2ggPT09ICd8Jykge1xuICAgICAgICAgIHBhcnRzLnB1c2goc3RyLnNsaWNlKHN0YXJ0LCBpKSk7XG4gICAgICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGFydHMucHVzaChzdHIuc2xpY2Uoc3RhcnQpKTtcbiAgICAgIHJldHVybiBwYXJ0cztcbiAgICB9O1xuXG4gICAgY29uc3QgcGFyc2VPbmVQaXBlID0gKHBpcGVTdHI6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgY29sb25JZHggPSBwaXBlU3RyLmluZGV4T2YoJzonKTtcbiAgICAgIGxldCBuYW1lOiBzdHJpbmc7XG4gICAgICBsZXQgYXJnc1Jhdzogc3RyaW5nO1xuICAgICAgaWYgKGNvbG9uSWR4ID09PSAtMSkge1xuICAgICAgICBuYW1lID0gcGlwZVN0ci50cmltKCk7XG4gICAgICAgIGFyZ3NSYXcgPSAnJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5hbWUgPSBwaXBlU3RyLnNsaWNlKDAsIGNvbG9uSWR4KS50cmltKCk7XG4gICAgICAgIGFyZ3NSYXcgPSBwaXBlU3RyLnNsaWNlKGNvbG9uSWR4ICsgMSkudHJpbSgpO1xuICAgICAgfVxuICAgICAgY29uc3QgYXJnU3RyaW5ncyA9IGFyZ3NSYXcgPyBUZW1wbGF0ZS5fc3BsaXRTdHJpbmcoYXJnc1JhdywgJywnKSA6IFtdO1xuICAgICAgY29uc3QgYXJncyA9IGFyZ1N0cmluZ3MubWFwKChhcmcpID0+IHtcbiAgICAgICAgY29uc3QgY2xlYW5BcmcgPSBhcmcudHJpbSgpLnJlcGxhY2UoL14oW1wiJ10pKFtcXHNcXFNdKilcXDEkLywgJyQyJyk7XG4gICAgICAgIGlmIChjbGVhbkFyZy5pbmNsdWRlcygnJHsnKSkge1xuICAgICAgICAgIHJldHVybiBUZW1wbGF0ZS5fcGFyc2UoY2xlYW5BcmcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB7IHR5cGU6ICd0ZXh0JyBhcyBjb25zdCwgdmFsdWU6IGNsZWFuQXJnIH07XG4gICAgICB9KTtcbiAgICAgIHJldHVybiB7IG5hbWUsIGFyZ3MgfTtcbiAgICB9O1xuXG4gICAgY29uc3QgcGFyc2VQaXBlQ2hhaW4gPSAoY2hhaW5TdHI6IHN0cmluZykgPT5cbiAgICAgIHNwbGl0QnlUb3BMZXZlbFBpcGUoY2hhaW5TdHIpLm1hcCgocykgPT4gcGFyc2VPbmVQaXBlKHMudHJpbSgpKSk7XG5cbiAgICBjb25zdCBwYXJzZVRhZyA9ICgpID0+IHtcbiAgICAgIGFkdmFuY2UoKTtcbiAgICAgIGFkdmFuY2UoKTsgLy8g6Lez6L+HICR7XG4gICAgICBjb25zdCBjb250ZW50ID0gcmVhZEJhbGFuY2VkQ29udGVudCgpO1xuICAgICAgY29uc3QgcGlwZUlkeCA9ICgoKSA9PiB7XG4gICAgICAgIGxldCBpbkQgPSBmYWxzZSxcbiAgICAgICAgICBpblMgPSBmYWxzZSxcbiAgICAgICAgICBlc2MgPSBmYWxzZTtcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBjb250ZW50Lmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgY2ggPSBjb250ZW50W2ldO1xuICAgICAgICAgIGlmIChlc2MpIHtcbiAgICAgICAgICAgIGVzYyA9IGZhbHNlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChjaCA9PT0gJ1xcXFwnKSB7XG4gICAgICAgICAgICBlc2MgPSB0cnVlO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICghaW5TICYmIGNoID09PSAnXCInKSBpbkQgPSAhaW5EO1xuICAgICAgICAgIGVsc2UgaWYgKCFpbkQgJiYgY2ggPT09IFwiJ1wiKSBpblMgPSAhaW5TO1xuICAgICAgICAgIGVsc2UgaWYgKCFpbkQgJiYgIWluUyAmJiBjaCA9PT0gJ3wnKSByZXR1cm4gaTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9KSgpO1xuICAgICAgY29uc3QgdmFyTmFtZSA9IHBpcGVJZHggPT09IC0xID8gY29udGVudC50cmltKCkgOiBjb250ZW50LnNsaWNlKDAsIHBpcGVJZHgpLnRyaW0oKTtcbiAgICAgIGNvbnN0IHBpcGVzID0gcGlwZUlkeCA9PT0gLTEgPyBbXSA6IHBhcnNlUGlwZUNoYWluKGNvbnRlbnQuc2xpY2UocGlwZUlkeCArIDEpLnRyaW0oKSk7XG4gICAgICByZXR1cm4geyB0eXBlOiAndGFnJyBhcyBjb25zdCwgdmFyTmFtZSwgcGlwZXMgfTtcbiAgICB9O1xuXG4gICAgd2hpbGUgKHBvcyA8IGlucHV0Lmxlbmd0aCkge1xuICAgICAgaWYgKHBlZWsoKSA9PT0gJyQnICYmIHBlZWsoMSkgPT09ICd7Jykge1xuICAgICAgICBub2Rlcy5wdXNoKHBhcnNlVGFnKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3Qgc3RhcnQgPSBwb3M7XG4gICAgICAgIHdoaWxlICghZW9mKCkgJiYgIShwZWVrKCkgPT09ICckJyAmJiBwZWVrKDEpID09PSAneycpKSBhZHZhbmNlKCk7XG4gICAgICAgIG5vZGVzLnB1c2goeyB0eXBlOiAndGV4dCcsIHZhbHVlOiBpbnB1dC5zbGljZShzdGFydCwgcG9zKSB9KTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG5vZGVzO1xuICB9XG5cbiAgLy8gPT09PT09PT09PSDmsYLlgLzpmLbmrrUo6L+Y5Y6fIHRlbXBsYXRlcy5qcyDnrKwgMjA5LTI1NCDooYwpID09PT09PT09PT1cbiAgcHJpdmF0ZSBzdGF0aWMgX2V2YWx1YXRlKFxuICAgIG5vZGVzOiBhbnlbXSxcbiAgICBkYXRhOiBUZW1wbGF0ZUNvbnRleHQsXG4gICAgdHJpbURhdGE6IFRlbXBsYXRlQ29udGV4dCxcbiAgKTogc3RyaW5nIHtcbiAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVzKSB7XG4gICAgICBpZiAobm9kZS50eXBlID09PSAndGV4dCcpIHtcbiAgICAgICAgcmVzdWx0ICs9IG5vZGUudmFsdWUgPz8gJyc7XG4gICAgICB9IGVsc2UgaWYgKG5vZGUudHlwZSA9PT0gJ3RhZycpIHtcbiAgICAgICAgcmVzdWx0ICs9IHRoaXMuX2V2YWxUYWcobm9kZSwgZGF0YSwgdHJpbURhdGEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcHJpdmF0ZSBzdGF0aWMgX2V2YWxUYWcoXG4gICAgdGFnOiB7IHZhck5hbWU6IHN0cmluZzsgcGlwZXM6IGFueVtdIH0sXG4gICAgZGF0YTogVGVtcGxhdGVDb250ZXh0LFxuICAgIHRyaW1EYXRhOiBUZW1wbGF0ZUNvbnRleHQsXG4gICk6IHN0cmluZyB7XG4gICAgbGV0IHZhbHVlOiB1bmtub3duO1xuICAgIGlmICh0YWcudmFyTmFtZSA9PT0gJ2RhdGEnKSB7XG4gICAgICBjb25zdCB7XG4gICAgICAgIHBhZ2VET00sIHllYXIsIG1vbnRoLCBkYXRlLCBkYXksIGZ1bGxEYXRlLCB0aW1lLCBob3VycywgbWludXRlcywgc2Vjb25kcyxcbiAgICAgICAgbW9iaWxlVXNlckFnZW50LCAuLi5yZXN0XG4gICAgICB9ID0gdHJpbURhdGE7XG4gICAgICB2YWx1ZSA9IEpTT04uc3RyaW5naWZ5KHJlc3QpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZSA9IChkYXRhIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVt0YWcudmFyTmFtZV07XG4gICAgfVxuXG4gICAgbGV0IGN1cnJlbnQgPSB2YWx1ZSAhPT0gdW5kZWZpbmVkID8gU3RyaW5nKHZhbHVlKSA6ICcnO1xuICAgIGlmICghdGFnLnBpcGVzLmxlbmd0aCkge1xuICAgICAgcmV0dXJuIHZhbHVlICE9PSB1bmRlZmluZWQgPyBTdHJpbmcodmFsdWUpIDogJyR7JyArIHRhZy52YXJOYW1lICsgJ30nO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgcGlwZSBvZiB0YWcucGlwZXMpIHtcbiAgICAgIGNvbnN0IHJlc29sdmVkQXJncyA9IHBpcGUuYXJncy5tYXAoKGFyZzogYW55KSA9PiB7XG4gICAgICAgIGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcbiAgICAgICAgICByZXR1cm4gdGhpcy5fZXZhbHVhdGUoYXJnLCBkYXRhLCB0cmltRGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGFyZyAmJiBhcmcudHlwZSA9PT0gJ3RleHQnKSByZXR1cm4gYXJnLnZhbHVlIGFzIHN0cmluZztcbiAgICAgICAgcmV0dXJuIGFyZztcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoaXNFbXB0eShjdXJyZW50KSAmJiAhWydleGlzdHMnLCAnZmluZCcsICdwcm9tcHQnXS5pbmNsdWRlcyhwaXBlLm5hbWUpKSByZXR1cm4gJyc7XG4gICAgICBpZiAocmVzb2x2ZWRBcmdzLmxlbmd0aCA9PT0gMCAmJiAhWydmaWx0ZXInLCAncHJvbXB0J10uaW5jbHVkZXMocGlwZS5uYW1lKSkgYnJlYWs7XG5cbiAgICAgIGNvbnN0IHByb2Nlc3NvciA9IFRlbXBsYXRlLl9wcm9jZXNzb3JzW3BpcGUubmFtZV07XG4gICAgICBpZiAocHJvY2Vzc29yKSB7XG4gICAgICAgIGN1cnJlbnQgPSBwcm9jZXNzb3IoY3VycmVudCwgcmVzb2x2ZWRBcmdzLCBkYXRhKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGN1cnJlbnQ7XG4gIH1cblxuICAvKiog5a2X56ym5Liy5YiG5Ymy6L6F5YqpKOi/mOWOnyB0ZW1wbGF0ZXMuanMg56ysIDI1Ny0yNzQg6KGMKSAqL1xuICBwcml2YXRlIHN0YXRpYyBfc3BsaXRTdHJpbmcodGV4dDogc3RyaW5nLCBzZXBhcmF0b3I6IHN0cmluZyk6IHN0cmluZ1tdIHtcbiAgICB0ZXh0ID0gdGV4dC50cmltKCk7XG4gICAgaWYgKHRleHQubGVuZ3RoID09PSAwKSByZXR1cm4gW107XG4gICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gW107XG4gICAgbGV0IGluUXVvdGVzID0gZmFsc2U7XG4gICAgbGV0IGluU2luZ2xlID0gZmFsc2U7XG4gICAgbGV0IHN0YXJ0ID0gMDtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcbiAgICAgIGlmICh0ZXh0W2ldID09PSBzZXBhcmF0b3IgJiYgIWluUXVvdGVzICYmICFpblNpbmdsZSkge1xuICAgICAgICBwYXJ0cy5wdXNoKHRleHQuc2xpY2Uoc3RhcnQsIGkpKTtcbiAgICAgICAgc3RhcnQgPSBpICsgMTtcbiAgICAgIH0gZWxzZSBpZiAodGV4dFtpXSA9PT0gJ1wiJyAmJiAhaW5TaW5nbGUpIHtcbiAgICAgICAgaW5RdW90ZXMgPSAhaW5RdW90ZXM7XG4gICAgICB9IGVsc2UgaWYgKHRleHRbaV0gPT09IFwiJ1wiICYmICFpblF1b3Rlcykge1xuICAgICAgICBpblNpbmdsZSA9ICFpblNpbmdsZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcGFydHMucHVzaCh0ZXh0LnNsaWNlKHN0YXJ0KSk7XG4gICAgcmV0dXJuIHBhcnRzO1xuICB9XG59XG5cbi8qKiDlhbzlrrnljp/pobnnm64gdGVtcGxhdGVzKHRleHQsIGRhdGEpIOWHveaVsOW8j+iwg+eUqCAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRlbXBsYXRlcyh0ZXh0OiB1bmtub3duLCBkYXRhOiBUZW1wbGF0ZUNvbnRleHQpOiBzdHJpbmcge1xuICByZXR1cm4gVGVtcGxhdGUucmVuZGVyKHRleHQsIGRhdGEpO1xufVxuIiwiLyoqXG4gKiDpgJrnlKjovoXliqnlh73mlbAgLSAxOjEg6L+Y5Y6f5Y6fIGpzL2Z1bmN0aW9uLmpzXG4gKiDmiYDmnIkgRy54eHgg5byV55So5pS55Li65LuOIHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKSDor7vlj5ZcbiAqL1xuaW1wb3J0IHsgdXNlU2V0dGluZ3NTdG9yZSB9IGZyb20gJ0BzdG9yZXMvc2V0dGluZ3MnO1xuaW1wb3J0IHsgdGVtcGxhdGVzLCB0eXBlIFRlbXBsYXRlQ29udGV4dCB9IGZyb20gJ0BsaWIvdGVtcGxhdGUnO1xuXG4vKiog5bCP5LqOIDEwIOWKoCAwKOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgNi04IOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBlbmRaZXJvKGRhdGU6IG51bWJlciB8IHN0cmluZyk6IHN0cmluZyB8IG51bWJlciB7XG4gIHJldHVybiBwYXJzZUludChTdHJpbmcoZGF0ZSksIDEwKSA8IDEwID8gYDAke2RhdGV9YCA6IGRhdGU7XG59XG5cbi8qKiDnp5LovawgSEg6TU06U1Mo6L+Y5Y6fIGZ1bmN0aW9uLmpzIOesrCAxNS0yMyDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gc2VjVG9UaW1lKHNlYzogbnVtYmVyKTogc3RyaW5nIHtcbiAgbGV0IGhvdXIgPSAoc2VjIC8gMzYwMCkgfCAwO1xuICBsZXQgbWluID0gKChzZWMgJSAzNjAwKSAvIDYwKSB8IDA7XG4gIHNlYyA9IChzZWMgJSA2MCkgfCAwO1xuICBsZXQgdGltZSA9IGhvdXIgPiAwID8gaG91ciArICc6JyA6ICcnO1xuICB0aW1lICs9IG1pbi50b1N0cmluZygpLnBhZFN0YXJ0KDIsICcwJykgKyAnOic7XG4gIHRpbWUgKz0gc2VjLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwgJzAnKTtcbiAgcmV0dXJuIHRpbWU7XG59XG5cbi8qKiDmoLzlvI/ljJbmr5Tnibnnjoco6L+Y5Y6fIGZ1bmN0aW9uLmpzIOesrCAzMC0zNSDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gZm9ybWF0Qml0cmF0ZShicHM6IG51bWJlcik6IHN0cmluZyB7XG4gIGlmIChicHMgPj0gMTAwMCAqIDEwMDApIHtcbiAgICByZXR1cm4gKGJwcyAvIDEwMDAgLyAxMDAwKS50b0ZpeGVkKDIpICsgJyBNYnBzJztcbiAgfVxuICByZXR1cm4gKGJwcyAvIDEwMDApLnRvRml4ZWQoMikgKyAnIGticHMnO1xufVxuXG4vKiog5a2X6IqC6L2s5aSn5bCPKOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgNDItNTEg6KGMKSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJ5dGVUb1NpemUoYnl0ZT86IG51bWJlcik6IHN0cmluZyB8IDAge1xuICBpZiAoIWJ5dGUgfHwgYnl0ZSA8IDEwMjQpIHJldHVybiAwO1xuICBpZiAoYnl0ZSA8IDEwMjQgKiAxMDI0KSB7XG4gICAgcmV0dXJuIChieXRlIC8gMTAyNCkudG9GaXhlZCgxKSArICdLQic7XG4gIH0gZWxzZSBpZiAoYnl0ZSA8IDEwMjQgKiAxMDI0ICogMTAyNCkge1xuICAgIHJldHVybiAoYnl0ZSAvIDEwMjQgLyAxMDI0KS50b0ZpeGVkKDEpICsgJ01CJztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gKGJ5dGUgLyAxMDI0IC8gMTAyNCAvIDEwMjQpLnRvRml4ZWQoMSkgKyAnR0InO1xuICB9XG59XG5cbi8qKiBGaXJlZm94IGRhdGEgVVJMIOS4i+i9vSjov5jljp8gZnVuY3Rpb24uanMg56ysIDU4LTY0IOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBkb3dubG9hZERhdGFVUkwodXJsOiBzdHJpbmcsIGZpbGVOYW1lOiBzdHJpbmcpOiB2b2lkIHtcbiAgY29uc3QgbGluayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTtcbiAgbGluay5ocmVmID0gdXJsO1xuICBsaW5rLmRvd25sb2FkID0gZmlsZU5hbWU7XG4gIGxpbmsuY2xpY2soKTtcbn1cblxuLyoqIOWIpOepuijov5jljp8gZnVuY3Rpb24uanMg56ysIDcxLTc2IOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBpc0VtcHR5KG9iajogdW5rbm93bik6IG9iaiBpcyBudWxsIHwgdW5kZWZpbmVkIHwgJycgfCAnICcge1xuICByZXR1cm4gKFxuICAgIHR5cGVvZiBvYmogPT09ICd1bmRlZmluZWQnIHx8XG4gICAgb2JqID09PSBudWxsIHx8XG4gICAgb2JqID09PSAnJyB8fFxuICAgIG9iaiA9PT0gJyAnXG4gICk7XG59XG5cbi8qKiDku44gdXJsIOS4reiOt+WPluaWh+S7tuWQjSjov5jljp8gZnVuY3Rpb24uanMg56ysIDE3OS0xODMg6KGMKSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFVybEZpbGVOYW1lKHVybDogc3RyaW5nKTogc3RyaW5nIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBwYXRobmFtZSA9IG5ldyBVUkwodXJsKS5wYXRobmFtZTtcbiAgICBjb25zdCBmaWxlbmFtZSA9IHBhdGhuYW1lLnNwbGl0KCcvJykucG9wKCk7XG4gICAgcmV0dXJuIGZpbGVuYW1lID8gZmlsZW5hbWUgOiAnTlVMTCc7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiAnTlVMTCc7XG4gIH1cbn1cblxuY29uc3QgcmVKU09OcGFyc2UgPSAvKFt7LF1cXHMqKShbXFx3LV0rKShcXHMqOikvZztcblxuLyoqIEpTT04ucGFyc2Ug5a656ZSZKOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgMTkyLTIwNyDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gSlNPTnBhcnNlPFQgPSBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPj4oXG4gIHN0cjogc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCxcbiAgZXJyb3I6IFQgPSB7fSBhcyBULFxuICBhdHRlbXB0ID0gMCxcbik6IFQge1xuICBpZiAoIXN0cikgcmV0dXJuIGVycm9yO1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKHN0cikgYXMgVDtcbiAgfSBjYXRjaCB7XG4gICAgaWYgKGF0dGVtcHQgPT09IDApIHtcbiAgICAgIHJlSlNPTnBhcnNlLmxhc3RJbmRleCA9IDA7XG4gICAgICBjb25zdCBmaXhlZFN0ciA9IHN0ci5yZXBsYWNlKHJlSlNPTnBhcnNlLCAnJDFcIiQyXCIkMycpO1xuICAgICAgcmV0dXJuIEpTT05wYXJzZShmaXhlZFN0ciwgZXJyb3IsICsrYXR0ZW1wdCk7XG4gICAgfVxuICAgIHJldHVybiBlcnJvcjtcbiAgfVxufVxuXG4vKiogQXJyYXlCdWZmZXIgLT4gQmxvYizlpKfkuo4gMkcg5YiH5YmyKOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgMjE1LTI0MSDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gQXJyYXlCdWZmZXJUb0Jsb2IoXG4gIGJ1ZmZlcjogQXJyYXlCdWZmZXIgfCBVaW50OEFycmF5IHwgQmxvYixcbiAgb3B0aW9uczogQmxvYlByb3BlcnR5QmFnID0ge30sXG4pOiBCbG9iIHtcbiAgaWYgKGJ1ZmZlciBpbnN0YW5jZW9mIEJsb2IpIHJldHVybiBidWZmZXI7XG4gIGxldCBidWY6IEFycmF5QnVmZmVyO1xuICBpZiAoYnVmZmVyIGluc3RhbmNlb2YgVWludDhBcnJheSkge1xuICAgIGJ1ZiA9IGJ1ZmZlci5idWZmZXIgYXMgQXJyYXlCdWZmZXI7XG4gIH0gZWxzZSB7XG4gICAgYnVmID0gYnVmZmVyIGFzIEFycmF5QnVmZmVyO1xuICB9XG4gIGlmICghYnVmLmJ5dGVMZW5ndGgpIHJldHVybiBuZXcgQmxvYigpO1xuICBpZiAoYnVmLmJ5dGVMZW5ndGggPj0gMiAqIDEwMjQgKiAxMDI0ICogMTAyNCkge1xuICAgIGNvbnN0IE1BWF9DSFVOSyA9IDEwMjQgKiAxMDI0ICogMTAyNDtcbiAgICBsZXQgb2Zmc2V0ID0gMDtcbiAgICBjb25zdCBibG9iczogQmxvYltdID0gW107XG4gICAgd2hpbGUgKG9mZnNldCA8IGJ1Zi5ieXRlTGVuZ3RoKSB7XG4gICAgICBjb25zdCBjaHVua1NpemUgPSBNYXRoLm1pbihNQVhfQ0hVTkssIGJ1Zi5ieXRlTGVuZ3RoIC0gb2Zmc2V0KTtcbiAgICAgIGNvbnN0IGNodW5rID0gYnVmLnNsaWNlKG9mZnNldCwgb2Zmc2V0ICsgY2h1bmtTaXplKTtcbiAgICAgIGJsb2JzLnB1c2gobmV3IEJsb2IoW2NodW5rXSkpO1xuICAgICAgb2Zmc2V0ICs9IGNodW5rU2l6ZTtcbiAgICB9XG4gICAgcmV0dXJuIG5ldyBCbG9iKGJsb2JzLCBvcHRpb25zKTtcbiAgfVxuICByZXR1cm4gbmV3IEJsb2IoW2J1Zl0sIG9wdGlvbnMpO1xufVxuXG5jb25zdCByZUZpbHRlckZpbGVOYW1lID0gL1s8PjpcInw/Kn5dL2c7XG5cbi8qKiDov4fmu6Tmlofku7blkI3nibnmrorlrZfnrKYo5LiN5ZCr6Lev5b6ELOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgMjY3LTI5MiDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gZmlsdGVyRmlsZU5hbWUoc3RyOiBzdHJpbmcgfCB1bmRlZmluZWQsIHRleHQ/OiBzdHJpbmcpOiBzdHJpbmcge1xuICBpZiAoIXN0cikgcmV0dXJuICcnO1xuICByZUZpbHRlckZpbGVOYW1lLmxhc3RJbmRleCA9IDA7XG4gIHN0ciA9IHN0ci5yZXBsYWNlQWxsKC9cXHUyMDBCL2csICcnKS5yZXBsYWNlQWxsKC9cXHUyMDBDL2csICcnKS5yZXBsYWNlQWxsKC9cXHUyMDBEL2csICcnKTtcbiAgc3RyID0gc3RyLnJlcGxhY2UocmVGaWx0ZXJGaWxlTmFtZSwgKG1hdGNoKSA9PiB7XG4gICAgaWYgKHRleHQpIHJldHVybiB0ZXh0O1xuICAgIGNvbnN0IG1hcDogUmVjb3JkPHN0cmluZywgc3RyaW5nPiA9IHtcbiAgICAgICc8JzogJyZsdDsnLFxuICAgICAgJz4nOiAnJmd0OycsXG4gICAgICAnOic6ICcmY29sb247JyxcbiAgICAgICdcIic6ICcmcXVvdDsnLFxuICAgICAgJ3wnOiAnJnZlcnQ7JyxcbiAgICAgICc/JzogJyZxdWVzdDsnLFxuICAgICAgJyonOiAnJmFzdDsnLFxuICAgICAgJ34nOiAnXycsXG4gICAgfTtcbiAgICByZXR1cm4gbWFwW21hdGNoXSA/PyBtYXRjaDtcbiAgfSk7XG4gIGlmIChzdHIuZW5kc1dpdGgoJy4nKSkgc3RyID0gc3RyICsgJ2NhdENhdGNoJztcbiAgaWYgKHN0ci5zdGFydHNXaXRoKCcuJykpIHN0ciA9ICdjYXRDYXRjaCcgKyBzdHI7XG4gIHJldHVybiBzdHI7XG59XG5cbi8qKiDmm7/mjaLmlofku7blkI3nibnmrorlrZfnrKYo5ZCr6Lev5b6ELOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgMjQ5LTI1OSDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gc3RyaW5nTW9kaWZ5KHN0cjogc3RyaW5nLCB0ZXh0Pzogc3RyaW5nKTogc3RyaW5nIHtcbiAgaWYgKCFzdHIpIHJldHVybiBzdHI7XG4gIHN0ciA9IGZpbHRlckZpbGVOYW1lKHN0ciwgdGV4dCk7XG4gIHN0ciA9IHN0ci5yZXBsYWNlKC9bXFxcXC9dL2csIChtYXRjaCkgPT4ge1xuICAgIGlmICh0ZXh0KSByZXR1cm4gdGV4dDtcbiAgICByZXR1cm4gbWF0Y2ggPT09ICdcXFxcJyA/ICcmYnNvbDsnIDogJyZzb2w7JztcbiAgfSk7XG4gIHJldHVybiBzdHI7XG59XG5cbi8qKiDmiYHlubPljJbltYzlpZflr7nosaEo6L+Y5Y6fIGZ1bmN0aW9uLmpzIOesrCAzMDAtMzE2IOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBmbGF0dGVuT2JqZWN0KFxuICBvYmo6IFJlY29yZDxzdHJpbmcsIHVua25vd24+LFxuICBwcmVmaXggPSAnJyxcbik6IFJlY29yZDxzdHJpbmcsIHVua25vd24+IHtcbiAgY29uc3QgcmVzdWx0OiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHt9O1xuICBmb3IgKGNvbnN0IGtleSBpbiBvYmopIHtcbiAgICBpZiAoIU9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSkpIGNvbnRpbnVlO1xuICAgIGNvbnN0IHZhbHVlID0gb2JqW2tleV07XG4gICAgY29uc3QgbmV3S2V5ID0gcHJlZml4ID8gYCR7cHJlZml4fVske2tleX1dYCA6IGtleTtcbiAgICBpZiAodmFsdWUgIT09IG51bGwgJiYgdHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIE9iamVjdC5hc3NpZ24ocmVzdWx0LCBmbGF0dGVuT2JqZWN0KHZhbHVlIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+LCBuZXdLZXkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0W25ld0tleV0gPSB2YWx1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqIOmAmumFjeespiAtPiBSZWdFeHAo6L+Y5Y6fIGluaXQuanMg56ysIDQzOS00NDkg6KGMKSAqL1xuZXhwb3J0IGZ1bmN0aW9uIHdpbGRjYXJkVG9SZWdleCh1cmxQYXR0ZXJuOiBzdHJpbmcpOiBSZWdFeHAge1xuICBjb25zdCByZWdleFBhdHRlcm4gPSB1cmxQYXR0ZXJuXG4gICAgLnJlcGxhY2UoL1suK14ke30oKXxbXFxdXFxcXF0vZywgJ1xcXFwkJicpXG4gICAgLnJlcGxhY2UoL1xcKi9nLCAnLionKVxuICAgIC5yZXBsYWNlKC9cXD8vZywgJy4nKTtcbiAgcmV0dXJuIG5ldyBSZWdFeHAoYF4ke3JlZ2V4UGF0dGVybn0kYCwgJ2knKTtcbn1cblxuLyoqIOWIpOaWrSB1cmwg5piv5ZCm5Zyo6YG/5YWN5oqT5Y+W5YiX6KGoKOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgNDQxLTQ0OSDooYwpICovXG5leHBvcnQgZnVuY3Rpb24gaXNEYW1uVXJsKHVybDogc3RyaW5nKTogYm9vbGVhbiB7XG4gIGNvbnN0IHMgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCk7XG4gIGZvciAoY29uc3QgcmUgb2Ygcy5kYW1uVXJsKSB7XG4gICAgcmUubGFzdEluZGV4ID0gMDtcbiAgICBpZiAocmUudGVzdCh1cmwpKSByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKiDliKTmlq0gdXJsIOaYr+WQpuWcqOWxj+iUvee9keWdgOS4rSjov5jljp8gZnVuY3Rpb24uanMg56ysIDQ1Ni00NjUg6KGMKSAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzTG9ja1VybCh1cmw6IHN0cmluZyk6IGJvb2xlYW4ge1xuICBjb25zdCBzID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICBmb3IgKGNvbnN0IHJ1bGUgb2Ygcy5ibG9ja1VybCkge1xuICAgIGlmICghcnVsZS5zdGF0ZSkgY29udGludWU7XG4gICAgcnVsZS51cmwubGFzdEluZGV4ID0gMDtcbiAgICBpZiAocnVsZS51cmwudGVzdCh1cmwpKSByZXR1cm4gdHJ1ZTtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKiDlhbPpl63moIfnrb7pobUo6L+Y5Y6fIGZ1bmN0aW9uLmpzIOesrCA0NzItNDgxIOihjCkgKi9cbmV4cG9ydCBmdW5jdGlvbiBjbG9zZVRhYih0YWJJZCA9IDApOiB2b2lkIHtcbiAgY2hyb21lLnRhYnMucXVlcnkoe30sIGFzeW5jICh0YWJzKSA9PiB7XG4gICAgaWYgKHRhYnMubGVuZ3RoID09PSAxKSB7XG4gICAgICBhd2FpdCBjaHJvbWUudGFicy5jcmVhdGUoeyB1cmw6ICdjaHJvbWU6Ly9uZXd0YWInIH0pO1xuICAgICAgdGFiSWQgPyBjaHJvbWUudGFicy5yZW1vdmUodGFiSWQpIDogd2luZG93LmNsb3NlKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhYklkID8gY2hyb21lLnRhYnMucmVtb3ZlKHRhYklkKSA6IHdpbmRvdy5jbG9zZSgpO1xuICAgIH1cbiAgfSk7XG59XG5cbi8qKlxuICog5omT5byA6Kej5p6Q5ZmoKG0zdTgvbXBkLOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgNDg4LTUwNSDooYwpXG4gKiBAcGFyYW0gZGF0YSDotYTmupDlr7nosaFcbiAqIEBwYXJhbSBvcHRpb25zIOmAiemhuShhdXRvRG93biAvIOetiSlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9wZW5QYXJzZXIoXG4gIGRhdGE6IHtcbiAgICB1cmw6IHN0cmluZztcbiAgICB0aXRsZT86IHN0cmluZztcbiAgICBkb3duRmlsZU5hbWU/OiBzdHJpbmc7XG4gICAgdGFiSWQ6IG51bWJlcjtcbiAgICBpbml0aWF0b3I/OiBzdHJpbmc7XG4gICAgcmVxdWVzdEhlYWRlcnM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgIHBhcnNpbmc/OiAnbTN1OCcgfCAnbXBkJztcbiAgfSxcbiAgb3B0aW9uczogeyBhdXRvRG93bj86IGJvb2xlYW47IFtrOiBzdHJpbmddOiB1bmtub3duIH0gPSB7fSxcbik6IHZvaWQge1xuICBjb25zdCBHID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICBjaHJvbWUudGFicy5nZXQoRy50YWJJZCwgKHRhYikgPT4ge1xuICAgIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoe1xuICAgICAgdXJsOiBkYXRhLnVybCxcbiAgICAgIHRpdGxlOiBkYXRhLnRpdGxlID8/ICcnLFxuICAgICAgZmlsZW5hbWU6IGRhdGEuZG93bkZpbGVOYW1lID8/ICcnLFxuICAgICAgdGFiaWQ6IFN0cmluZyhkYXRhLnRhYklkID09PSAtMSA/IEcudGFiSWQgOiBkYXRhLnRhYklkKSxcbiAgICAgIGluaXRpYXRvcjogZGF0YS5pbml0aWF0b3IgPz8gJycsXG4gICAgICByZXF1ZXN0SGVhZGVyczogZGF0YS5yZXF1ZXN0SGVhZGVycyA/IEpTT04uc3RyaW5naWZ5KGRhdGEucmVxdWVzdEhlYWRlcnMpIDogJycsXG4gICAgfSk7XG4gICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMob3B0aW9ucykpIHtcbiAgICAgIHBhcmFtcy5zZXQoaywgdHlwZW9mIHYgPT09ICdib29sZWFuJyA/ICh2ID8gJzEnIDogJzAnKSA6IFN0cmluZyh2KSk7XG4gICAgfVxuICAgIGNvbnN0IHBhcnNlciA9IGRhdGEucGFyc2luZyA/PyAnbTN1OCc7XG4gICAgY29uc3QgdXJsID0gYC8ke3BhcnNlcn0uaHRtbD8ke3BhcmFtcy50b1N0cmluZygpfWA7XG4gICAgY2hyb21lLnRhYnMuY3JlYXRlKHtcbiAgICAgIHVybCxcbiAgICAgIGluZGV4OiB0YWIuaW5kZXggKyAxLFxuICAgICAgYWN0aXZlOiBHLmlzTW9iaWxlIHx8ICFvcHRpb25zLmF1dG9Eb3duLFxuICAgIH0pO1xuICB9KTtcbn1cblxuLyoqXG4gKiDmibnph4/lj5HpgIHlr7nosaHmlbDnu4TliLDmnKzlnLAo6L+Y5Y6fIGZ1bmN0aW9uLmpzIOesrCA0MjYtNDM5IOihjClcbiAqL1xuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHNlbmQybG9jYWxBcnJheShcbiAgYWN0aW9uOiBzdHJpbmcsXG4gIGFycmF5RGF0YTogdW5rbm93bltdIHwgUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gIHRhYklkID0gMCxcbik6IFByb21pc2U8UmVzcG9uc2U+IHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGFycmF5RGF0YSkpIHtcbiAgICBhcnJheURhdGEgPSBbYXJyYXlEYXRhXTtcbiAgfVxuICBjb25zdCBHID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICBjb25zdCByZXN1bHRzID0gKGFycmF5RGF0YSBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPltdKS5tYXAoXG4gICAgKGl0ZW0sIGluZGV4KSA9PiB0ZW1wbGF0ZXMoJyR7ZGF0YX0nLCB7IC4uLihpdGVtIGFzIG9iamVjdCksIGFjdGlvbiwgaW5kZXgsIHRhYklkIH0gYXMgVGVtcGxhdGVDb250ZXh0KSxcbiAgKTtcbiAgY29uc3QgYm9keSA9IEcub3B0aW9ucy5zZW5kMmxvY2FsQm9keS5yZXBsYWNlQWxsKCcke2RhdGF9JywgYFske3Jlc3VsdHMuam9pbignLCcpfV1gKTtcbiAgY29uc3QgcG9zdERhdGEgPSBKU09OcGFyc2UoYm9keSwgeyBhY3Rpb24sIHRhYklkIH0pO1xuICByZXR1cm4gZXhlY3V0ZUNvcmVSZXF1ZXN0KHBvc3REYXRhLCB7IGFjdGlvbiwgdGFiSWQgfSk7XG59XG5cbi8qKlxuICog5Y+R6YCB5Y2V5p2h5pWw5o2u5Yiw5pys5ZywKOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgNDA2LTQxOCDooYwpXG4gKi9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzZW5kMmxvY2FsKFxuICBhY3Rpb246IHN0cmluZyxcbiAgZGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4gfCBzdHJpbmcsXG4gIHRhYklkID0gMCxcbik6IFByb21pc2U8UmVzcG9uc2U+IHtcbiAgY29uc3QgRyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKTtcbiAgbGV0IGJvZHkgPSBHLm9wdGlvbnMuc2VuZDJsb2NhbEJvZHk7XG4gIGxldCBwb3N0RGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG5cbiAgaWYgKGFjdGlvbiA9PT0gJ2FkZEtleScgfHwgdHlwZW9mIGRhdGEgPT09ICdzdHJpbmcnKSB7XG4gICAgYm9keSA9IGJvZHkucmVwbGFjZUFsbCgnJHtkYXRhfScsIGBcIiR7ZGF0YX1cImApO1xuICAgIHBvc3REYXRhID0geyBhY3Rpb24sIHRhYklkIH07XG4gIH0gZWxzZSB7XG4gICAgKGRhdGEgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj4pLmFjdGlvbiA9IGFjdGlvbjtcbiAgICBwb3N0RGF0YSA9IGRhdGEgYXMgUmVjb3JkPHN0cmluZywgdW5rbm93bj47XG4gIH1cblxuICAvLyB0ZW1wbGF0ZXMg5riy5p+TXG4gIGNvbnN0IHJlbmRlcmVkID0gdGVtcGxhdGVzKGJvZHksIHsgLi4ucG9zdERhdGEsIHRhYklkIH0gYXMgVGVtcGxhdGVDb250ZXh0KTtcbiAgcmV0dXJuIGV4ZWN1dGVDb3JlUmVxdWVzdChKU09OcGFyc2UocmVuZGVyZWQsIHBvc3REYXRhKSwgcG9zdERhdGEgYXMgVGVtcGxhdGVDb250ZXh0KTtcbn1cblxuLyoqIOaguOW/g+WPkemAgeivt+axgijov5jljp8gZnVuY3Rpb24uanMg56ysIDMyMy0zOTgg6KGMKSAqL1xuYXN5bmMgZnVuY3Rpb24gZXhlY3V0ZUNvcmVSZXF1ZXN0KFxuICBwb3N0RGF0YTogUmVjb3JkPHN0cmluZywgdW5rbm93bj4sXG4gIHRlbXBsYXRlQ29udGV4dDogVGVtcGxhdGVDb250ZXh0LFxuKTogUHJvbWlzZTxSZXNwb25zZT4ge1xuICBjb25zdCBHID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICBjb25zdCBvcHRpb246IFJlcXVlc3RJbml0ID0geyBtZXRob2Q6IEcub3B0aW9ucy5zZW5kMmxvY2FsTWV0aG9kIH07XG5cbiAgdHJ5IHtcbiAgICBsZXQgc2VuZDJsb2NhbFVSTCA9IHRlbXBsYXRlcyhHLm9wdGlvbnMuc2VuZDJsb2NhbFVSTCwgdGVtcGxhdGVDb250ZXh0KTtcbiAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHNlbmQybG9jYWxVUkwpO1xuXG4gICAgaWYgKG9wdGlvbi5tZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICBjb25zdCBmbGF0dGVuZWQgPSBmbGF0dGVuT2JqZWN0KHBvc3REYXRhKTtcbiAgICAgIGNvbnN0IHVybFBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoKTtcbiAgICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGZsYXR0ZW5lZCkpIHtcbiAgICAgICAgdXJsUGFyYW1zLnNldChrLCBTdHJpbmcodikpO1xuICAgICAgfVxuICAgICAgcGFyc2VkVXJsLnNlYXJjaCA9IHBhcnNlZFVybC5zZWFyY2hcbiAgICAgICAgPyBgJHtwYXJzZWRVcmwuc2VhcmNofSYke3VybFBhcmFtcy50b1N0cmluZygpfWBcbiAgICAgICAgOiBgPyR7dXJsUGFyYW1zLnRvU3RyaW5nKCl9YDtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgY29udGVudFR5cGVNYXA6IFJlY29yZDxudW1iZXIsIHN0cmluZz4gPSB7XG4gICAgICAgIDA6ICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnLFxuICAgICAgICAxOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgICAgIDI6ICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnLFxuICAgICAgICAzOiAndGV4dC9wbGFpbicsXG4gICAgICB9O1xuICAgICAgY29uc3QgY29udGVudFR5cGUgPSBjb250ZW50VHlwZU1hcFtHLm9wdGlvbnMuc2VuZDJsb2NhbFR5cGVdID8/ICdhcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ9dXRmLTgnO1xuICAgICAgb3B0aW9uLmhlYWRlcnMgPSB7ICdDb250ZW50LVR5cGUnOiBjb250ZW50VHlwZSB9O1xuXG4gICAgICBzd2l0Y2ggKGNvbnRlbnRUeXBlKSB7XG4gICAgICAgIGNhc2UgJ2FwcGxpY2F0aW9uL2pzb247Y2hhcnNldD11dGYtOCc6XG4gICAgICAgICAgb3B0aW9uLmJvZHkgPSBKU09OLnN0cmluZ2lmeShwb3N0RGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ211bHRpcGFydC9mb3JtLWRhdGEnOiB7XG4gICAgICAgICAgY29uc3QgZm9ybURhdGEgPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgICAgICBjb25zdCBmbGF0dGVuZWQgPSBmbGF0dGVuT2JqZWN0KHBvc3REYXRhKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IFtrLCB2XSBvZiBPYmplY3QuZW50cmllcyhmbGF0dGVuZWQpKSB7XG4gICAgICAgICAgICBmb3JtRGF0YS5hcHBlbmQoaywgU3RyaW5nKHYpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgb3B0aW9uLmJvZHkgPSBmb3JtRGF0YTtcbiAgICAgICAgICBkZWxldGUgKG9wdGlvbi5oZWFkZXJzIGFzIFJlY29yZDxzdHJpbmcsIHN0cmluZz4pWydDb250ZW50LVR5cGUnXTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQnOiB7XG4gICAgICAgICAgY29uc3QgZmxhdHRlbmVkID0gZmxhdHRlbk9iamVjdChwb3N0RGF0YSk7XG4gICAgICAgICAgY29uc3QgdXJsUGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICAgICAgICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKGZsYXR0ZW5lZCkpIHtcbiAgICAgICAgICAgIHVybFBhcmFtcy5zZXQoaywgU3RyaW5nKHYpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgb3B0aW9uLmJvZHkgPSB1cmxQYXJhbXMudG9TdHJpbmcoKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBjYXNlICd0ZXh0L3BsYWluJzpcbiAgICAgICAgICBvcHRpb24uYm9keSA9IEpTT04uc3RyaW5naWZ5KHBvc3REYXRhKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoRy5vcHRpb25zLnNlbmQybG9jYWxIZWFkZXJzKSB7XG4gICAgICBjb25zdCBjdXN0b21IZWFkZXJzID0gSlNPTnBhcnNlPFJlY29yZDxzdHJpbmcsIHVua25vd24+PihHLm9wdGlvbnMuc2VuZDJsb2NhbEhlYWRlcnMsIHt9KTtcbiAgICAgIGlmICh0eXBlb2YgY3VzdG9tSGVhZGVycyA9PT0gJ3N0cmluZycpIHJldHVybiBhd2FpdCBmZXRjaChwYXJzZWRVcmwudG9TdHJpbmcoKSwgb3B0aW9uKTtcbiAgICAgIGlmICghb3B0aW9uLmhlYWRlcnMpIG9wdGlvbi5oZWFkZXJzID0ge307XG4gICAgICBmb3IgKGNvbnN0IGtleSBpbiBjdXN0b21IZWFkZXJzKSB7XG4gICAgICAgIChvcHRpb24uaGVhZGVycyBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+KVtrZXldID0gU3RyaW5nKGN1c3RvbUhlYWRlcnNba2V5XSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIGF3YWl0IGZldGNoKHBhcnNlZFVybC50b1N0cmluZygpLCBvcHRpb24pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgdGhyb3cgZTtcbiAgfVxufVxuXG4vKiog6I635Y+W6L+c56iL5paH5Lu25aSn5bCPKOi/mOWOnyBmdW5jdGlvbi5qcyDnrKwgNTQzLTU3MCDooYwpICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0UmVtb3RlRmlsZVNpemUodXJsOiBzdHJpbmcpOiBQcm9taXNlPG51bWJlcj4ge1xuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwgeyBtZXRob2Q6ICdIRUFEJyB9KTtcbiAgICBjb25zdCBzaXplID0gcGFyc2VJbnQocmVzLmhlYWRlcnMuZ2V0KCdjb250ZW50LWxlbmd0aCcpID8/ICcnLCAxMCk7XG4gICAgaWYgKHNpemUgJiYgIU51bWJlci5pc05hTihzaXplKSkgcmV0dXJuIHNpemU7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdIRUFEIG5vIGNvbnRlbnQtbGVuZ3RoJyk7XG4gIH0gY2F0Y2gge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIGhlYWRlcnM6IHsgUmFuZ2U6ICdieXRlcz0wLTAnIH0sXG4gICAgfSk7XG4gICAgY29uc3QgY29udGVudFJhbmdlID0gcmVzLmhlYWRlcnMuZ2V0KCdjb250ZW50LXJhbmdlJyk7XG4gICAgaWYgKGNvbnRlbnRSYW5nZSkge1xuICAgICAgY29uc3QgbWF0Y2ggPSAvXFwvKFxcZCspJC8uZXhlYyhjb250ZW50UmFuZ2UpO1xuICAgICAgaWYgKG1hdGNoKSB7XG4gICAgICAgIGNvbnN0IHNpemUgPSBwYXJzZUludChtYXRjaFsxXSA/PyAnJywgMTApO1xuICAgICAgICBpZiAoc2l6ZSAmJiAhTnVtYmVyLmlzTmFOKHNpemUpKSByZXR1cm4gc2l6ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgY29uc3Qgc2l6ZSA9IHBhcnNlSW50KHJlcy5oZWFkZXJzLmdldCgnY29udGVudC1sZW5ndGgnKSA/PyAnJywgMTApO1xuICAgIGlmIChzaXplICYmICFOdW1iZXIuaXNOYU4oc2l6ZSkpIHJldHVybiBzaXplO1xuICAgIHRocm93IG5ldyBFcnJvcignR0VUIHJhbmdlIG5vIHNpemUnKTtcbiAgfVxufVxuXG4vKiog6I635Y+W5b2T5YmNIHRhYiBpZCjljp/pobnnm64gaW1wbGljaXQpICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q3VycmVudFRhYklkKCk6IFByb21pc2U8bnVtYmVyPiB7XG4gIGNvbnN0IFt0YWJdID0gYXdhaXQgY2hyb21lLnRhYnMucXVlcnkoeyBhY3RpdmU6IHRydWUsIGN1cnJlbnRXaW5kb3c6IHRydWUgfSk7XG4gIHJldHVybiB0YWI/LmlkID8/IC0xO1xufVxuXG4vKiog5piv5ZCm5Li656e75Yqo56uvIFVBKOi/mOWOnyBHLmlzTW9iaWxlKSAqL1xuZXhwb3J0IGNvbnN0IGlzTW9iaWxlOiBib29sZWFuID1cbiAgdHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiZcbiAgL01vYmlsZXxBbmRyb2lkfGlQaG9uZXxpUGFkL2kudGVzdChuYXZpZ2F0b3IudXNlckFnZW50KTtcbiIsIi8qKlxuICogaTE4biDovoXliqk66L+Y5Y6fIGNocm9tZS5pMThuLmdldE1lc3NhZ2Ug6LCD55SoXG4gKiBfbG9jYWxlcyDkuIvnmoQgbWVzc2FnZXMuanNvbiDpgJrov4cgV1hUIOeahCBwdWJsaWMg55uu5b2V5Yqg6L29XG4gKiB0eXBlb2YgY2hyb21lIOWIpOaWrTrpnZ7mianlsZXkuIrkuIvmlocoaHR0cCDmtYvor5UvU1NSKeS4i+aPkOS+myBmYWxsYmFjayzpgb/lhY3muLLmn5PmnJ/mipvplJlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGkxOG4oa2V5OiBzdHJpbmcsIHN1YnN0aXR1dGlvbnM/OiBzdHJpbmcgfCBzdHJpbmdbXSk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgY2hyb21lID09PSAndW5kZWZpbmVkJyB8fCAhY2hyb21lLmkxOG4pIHJldHVybiBrZXk7XG4gIHJldHVybiBjaHJvbWUuaTE4bi5nZXRNZXNzYWdlKGtleSwgc3Vic3RpdHV0aW9ucykgfHwga2V5O1xufVxuXG4vKiog6I635Y+W5b2T5YmNIFVJIOivreiogCAqL1xuZXhwb3J0IGZ1bmN0aW9uIGdldFVJTGFuZ3VhZ2UoKTogc3RyaW5nIHtcbiAgaWYgKHR5cGVvZiBjaHJvbWUgPT09ICd1bmRlZmluZWQnIHx8ICFjaHJvbWUuaTE4bikgcmV0dXJuIG5hdmlnYXRvci5sYW5ndWFnZSB8fCAnZW4nO1xuICByZXR1cm4gY2hyb21lLmkxOG4uZ2V0VUlMYW5ndWFnZT8uKCkgfHwgbmF2aWdhdG9yLmxhbmd1YWdlIHx8ICdlbic7XG59XG5cbi8qKiDmianlsZXlvZPliY3niYjmnKzlj7cgKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRFeHRlbnNpb25WZXJzaW9uKCk6IHN0cmluZyB7XG4gIGlmICh0eXBlb2YgY2hyb21lID09PSAndW5kZWZpbmVkJyB8fCAhY2hyb21lLnJ1bnRpbWUpIHJldHVybiAnMC4xLjAnO1xuICByZXR1cm4gY2hyb21lLnJ1bnRpbWUuZ2V0TWFuaWZlc3QoKS52ZXJzaW9uO1xufVxuXG4vKiog5omp5bGV5ZCNKOS7jiBtYW5pZmVzdCDnmoQgX19NU0dfY2F0Q2F0Y2hfXyDop6PmnpDlkI4pICovXG5leHBvcnQgZnVuY3Rpb24gZ2V0RXh0ZW5zaW9uTmFtZSgpOiBzdHJpbmcge1xuICBpZiAodHlwZW9mIGNocm9tZSA9PT0gJ3VuZGVmaW5lZCcgfHwgIWNocm9tZS5ydW50aW1lKSByZXR1cm4gJ+eMq+aKkyc7XG4gIHJldHVybiBjaHJvbWUucnVudGltZS5nZXRNYW5pZmVzdCgpLm5hbWU7XG59XG4iLCIvKipcbiAqIEJhY2tncm91bmQgU2VydmljZSBXb3JrZXJcbiAqIDE6MSDov5jljp/ljp8ganMvYmFja2dyb3VuZC5qcyDmoLjlv4PpgLvovpFcbiAqXG4gKiAtIFNlcnZpY2UgV29ya2VyIOmYsue7iOatoihIZWFydEJlYXQgKyBnZXRQbGF0Zm9ybUluZm8pXG4gKiAtIHdlYlJlcXVlc3Qg55uR5ZCsKG9uU2VuZEhlYWRlcnMgLyBvblJlc3BvbnNlU3RhcnRlZCAvIG9uRXJyb3JPY2N1cnJlZClcbiAqIC0gYWxhcm1zIOWumuaXtua4heeQhiArIOS/neWtmOe8k+WtmFxuICogLSBvbk1lc3NhZ2Ug5aSE55CGIHB1c2hEYXRhL2dldEFsbERhdGEvZ2V0RGF0YS9jbGVhckRhdGEvY2xlYXJSZWR1bmRhbnQvZW5hYmxlL1xuICogICAgICAgICAgICBnZXRCdXR0b25TdGF0ZS9tb2JpbGVVc2VyQWdlbnQvYXV0b0Rvd24vc2NyaXB0L3NjcmlwdEkxOG4vXG4gKiAgICAgICAgICAgIEhlYXJ0QmVhdC9hZGRNZWRpYS9jYXRDYXRjaEZGbXBlZy9jYXREb3duL3NlbmQybG9jYWwvYXJpYTIvaW52b2tlL21xdHQvXG4gKiAgICAgICAgICAgIGRhbW5VcmxIYXMvY2xvc2VTY3JpcHQg562JXG4gKiAtIG9uTWVzc2FnZUV4dGVybmFsIOWkhOeQhuWklumDqOaJqeWxlSBnZXREYXRhL2dldEN1cnJlbnRUYWJEYXRhXG4gKiAtIG9uQWN0aXZhdGVkIC8gb25Gb2N1c0NoYW5nZWQgLyBvblVwZGF0ZWQgLyBvbkNvbW1pdHRlZCAvIG9uUmVtb3ZlZCAvIG9uQ29tcGxldGVkXG4gKiAtIGNvbW1hbmRzICsgY29udGV4dE1lbnVzKGNyZWF0ZSArIG9uQ2xpY2sg5aSN55SoIHJ1bkNvbW1hbmRzKVxuICogLSBkb3dubG9hZHMub25DaGFuZ2VkIOWkhOeQhuWbvueJh+S4i+i9veWksei0peWFnOW6lVxuICovXG5pbXBvcnQgeyBkZWZpbmVCYWNrZ3JvdW5kIH0gZnJvbSAnd3h0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kJztcbmltcG9ydCB7IHVzZVNldHRpbmdzU3RvcmUgfSBmcm9tICdAc3RvcmVzL3NldHRpbmdzJztcbmltcG9ydCB7IHVzZU1lZGlhU3RvcmUsIHR5cGUgTWVkaWFJdGVtIH0gZnJvbSAnQHN0b3Jlcy9tZWRpYSc7XG5pbXBvcnQgeyB1c2VSdW50aW1lU3RvcmUgfSBmcm9tICdAc3RvcmVzL3J1bnRpbWUnO1xuaW1wb3J0IHtcbiAgQ2hlY2tFeHRlbnNpb24sXG4gIENoZWNrVHlwZSxcbiAgZmlsZU5hbWVQYXJzZSxcbiAgZ2V0UmVzcG9uc2VIZWFkZXJzVmFsdWUsXG4gIGdldFJlcXVlc3RIZWFkZXJzLFxuICBTZXRJY29uLFxuICBtb2JpbGVVc2VyQWdlbnQsXG4gIGlzU3BlY2lhbFBhZ2UsXG4gIGNsZWFyUmVkdW5kYW50LFxuICBwYXJzZUF0dGFjaG1lbnRGaWxlbmFtZSxcbn0gZnJvbSAnQGxpYi9maW5kLW1lZGlhJztcbmltcG9ydCB7XG4gIGlzRGFtblVybCxcbiAgaXNMb2NrVXJsLFxuICBzdHJpbmdNb2RpZnksXG4gIGZpbHRlckZpbGVOYW1lLFxuICBzZW5kMmxvY2FsLFxufSBmcm9tICdAbGliL2Z1bmN0aW9uJztcbmltcG9ydCB7IHRlbXBsYXRlcyB9IGZyb20gJ0BsaWIvdGVtcGxhdGUnO1xuaW1wb3J0IHR5cGUgeyBUZW1wbGF0ZUNvbnRleHQgfSBmcm9tICdAbGliL3RlbXBsYXRlJztcbmltcG9ydCB7IGkxOG4gfSBmcm9tICdAbGliL2kxOG4nO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgLy8gPT09PT0g5Yid5aeL5YyWID09PT09XG4gIHZvaWQgKGFzeW5jICgpID0+IHtcbiAgICBjb25zdCBzID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICAgIGF3YWl0IFByb21pc2UuYWxsKFtzLmxvYWRGcm9tU3luYygpLCBzLmxvYWRGcm9tTG9jYWwoKV0pO1xuICAgIGF3YWl0IHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKS5sb2FkRnJvbVN0b3JhZ2UoKTtcbiAgICAvLyBTVyDlkK/liqjml7bnoa7kv53lj7PplK7oj5zljZXlrZjlnKgo6L+Y5Y6f5Y6fIGluaXQuanMgSW5pdE9wdGlvbnMg5pyr5bC+IGNvbnRleHRNZW51c0luaXQg6LCD55SoKVxuICAgIGNvbnRleHRNZW51c0luaXQoKTtcbiAgfSkoKTtcblxuICAvLyA9PT09PSBvbkluc3RhbGxlZDrlronoo4Uv5Y2H57qn5pe26YeN5bu65Y+z6ZSu6I+c5Y2VKOi/mOWOn+WOnyBiYWNrZ3JvdW5kLmpzIG9uSW5zdGFsbGVkKSA9PT09PVxuICBjaHJvbWUucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4gICAgY29udGV4dE1lbnVzSW5pdCgpO1xuICB9KTtcblxuICAvLyA9PT09PSBTZXJ2aWNlIFdvcmtlciDpmLLnu4jmraIo6L+Y5Y6fIGJhY2tncm91bmQuanMgMS0yOCDooYwpID09PT09XG4gIGNocm9tZS53ZWJOYXZpZ2F0aW9uLm9uQmVmb3JlTmF2aWdhdGUuYWRkTGlzdGVuZXIoKCkgPT4gdW5kZWZpbmVkKTtcbiAgY2hyb21lLndlYk5hdmlnYXRpb24ub25IaXN0b3J5U3RhdGVVcGRhdGVkLmFkZExpc3RlbmVyKCgpID0+IHVuZGVmaW5lZCk7XG5cbiAgY2hyb21lLnJ1bnRpbWUub25Db25uZWN0LmFkZExpc3RlbmVyKChwb3J0KSA9PiB7XG4gICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvciB8fCBwb3J0Lm5hbWUgIT09ICdIZWFydEJlYXQnKSByZXR1cm47XG4gICAgcG9ydC5wb3N0TWVzc2FnZSgnSGVhcnRCZWF0Jyk7XG4gICAgcG9ydC5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoKCkgPT4gdW5kZWZpbmVkKTtcbiAgICBjb25zdCBpbnRlcnZhbCA9IHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIGNsZWFySW50ZXJ2YWwoaW50ZXJ2YWwpO1xuICAgICAgcG9ydC5kaXNjb25uZWN0KCk7XG4gICAgfSwgMjUwMDAwKTtcbiAgICBwb3J0Lm9uRGlzY29ubmVjdC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4gICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yKSByZXR1cm47XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIOavjyAyNSDnp5LllKTphpLkuIDmrKEgU1dcbiAgc2V0SW50ZXJ2YWwoKCkgPT4gY2hyb21lLnJ1bnRpbWUuZ2V0UGxhdGZvcm1JbmZvKCgpID0+IHVuZGVmaW5lZCksIDI1XzAwMCk7XG5cbiAgLy8gPT09PT0gd2ViUmVxdWVzdCDnm5HlkKwo6L+Y5Y6fIG9uU2VuZEhlYWRlcnMgLyBvblJlc3BvbnNlU3RhcnRlZCAvIG9uRXJyb3JPY2N1cnJlZCkgPT09PT1cbiAgY2hyb21lLndlYlJlcXVlc3Qub25TZW5kSGVhZGVycy5hZGRMaXN0ZW5lcihcbiAgICAoZGF0YSkgPT4ge1xuICAgICAgY29uc3QgcyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKTtcbiAgICAgIGlmIChzLmluaXRTeW5jQ29tcGxldGUgJiYgIXMuZW5hYmxlKSByZXR1cm47XG4gICAgICBpZiAoZGF0YS5yZXF1ZXN0SGVhZGVycykge1xuICAgICAgICBjb25zdCBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+ID0ge307XG4gICAgICAgIGZvciAoY29uc3QgaCBvZiBkYXRhLnJlcXVlc3RIZWFkZXJzKSBoZWFkZXJzW2gubmFtZV0gPSBoLnZhbHVlID8/ICcnO1xuICAgICAgICB1c2VSdW50aW1lU3RvcmUuZ2V0U3RhdGUoKS5zZXRSZXF1ZXN0SGVhZGVycyhkYXRhLnJlcXVlc3RJZCwgZGF0YS5yZXF1ZXN0SGVhZGVycyk7XG4gICAgICAgIChkYXRhIGFzIGFueSkuYWxsUmVxdWVzdEhlYWRlcnMgPSBkYXRhLnJlcXVlc3RIZWFkZXJzO1xuICAgICAgfVxuICAgICAgdHJ5IHtcbiAgICAgICAgdm9pZCBmaW5kTWVkaWEoZGF0YSwgdHJ1ZSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB7IHVybHM6IFsnPGFsbF91cmxzPiddIH0sXG4gICAgWydyZXF1ZXN0SGVhZGVycycsICdleHRyYUhlYWRlcnMnXSxcbiAgKTtcblxuICBjaHJvbWUud2ViUmVxdWVzdC5vblJlc3BvbnNlU3RhcnRlZC5hZGRMaXN0ZW5lcihcbiAgICAoZGF0YSkgPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgYWxsSGVhZGVycyA9IHVzZVJ1bnRpbWVTdG9yZS5nZXRTdGF0ZSgpLmdldFJlcXVlc3RIZWFkZXJzKGRhdGEucmVxdWVzdElkKTtcbiAgICAgICAgaWYgKGFsbEhlYWRlcnMpIHtcbiAgICAgICAgICAoZGF0YSBhcyBhbnkpLmFsbFJlcXVlc3RIZWFkZXJzID0gYWxsSGVhZGVycztcbiAgICAgICAgICB1c2VSdW50aW1lU3RvcmUuZ2V0U3RhdGUoKS5kZWxldGVSZXF1ZXN0SGVhZGVycyhkYXRhLnJlcXVlc3RJZCk7XG4gICAgICAgIH1cbiAgICAgICAgdm9pZCBmaW5kTWVkaWEoZGF0YSk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSwgZGF0YSk7XG4gICAgICB9XG4gICAgfSxcbiAgICB7IHVybHM6IFsnPGFsbF91cmxzPiddIH0sXG4gICAgWydyZXNwb25zZUhlYWRlcnMnXSxcbiAgKTtcblxuICBjaHJvbWUud2ViUmVxdWVzdC5vbkVycm9yT2NjdXJyZWQuYWRkTGlzdGVuZXIoKGRhdGEpID0+IHtcbiAgICB1c2VSdW50aW1lU3RvcmUuZ2V0U3RhdGUoKS5kZWxldGVSZXF1ZXN0SGVhZGVycyhkYXRhLnJlcXVlc3RJZCk7XG4gICAgdXNlUnVudGltZVN0b3JlLmdldFN0YXRlKCkuZGVsZXRlQmxhY2tMaXN0KGRhdGEucmVxdWVzdElkKTtcbiAgfSwgeyB1cmxzOiBbJzxhbGxfdXJscz4nXSB9KTtcblxuICAvLyA9PT09PSBhbGFybXMg5a6a5pe25Lu75YqhKOi/mOWOnyBhbGFybXMub25BbGFybSkgPT09PT1cbiAgY2hyb21lLmFsYXJtcy5vbkFsYXJtLmFkZExpc3RlbmVyKChhbGFybSkgPT4ge1xuICAgIGlmIChhbGFybS5uYW1lID09PSAnbm93Q2xlYXInIHx8IGFsYXJtLm5hbWUgPT09ICdjbGVhcicpIHtcbiAgICAgIGNsZWFyUmVkdW5kYW50KCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmIChhbGFybS5uYW1lID09PSAnc2F2ZScpIHtcbiAgICAgIHZvaWQgdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLnBlcnNpc3QoKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vID09PT09IG9uTWVzc2FnZSjov5jljp8gYmFja2dyb3VuZC5qcyDnrKwgMzQyLTU4NSDooYwpID09PT09XG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobXNnOiBhbnksIHNlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcikgcmV0dXJuO1xuICAgIGNvbnN0IHMgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCk7XG4gICAgaWYgKCFzLmluaXRMb2NhbENvbXBsZXRlIHx8ICFzLmluaXRTeW5jQ29tcGxldGUpIHtcbiAgICAgIHNlbmRSZXNwb25zZSgnZXJyb3InKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBjb25zdCBNZXNzYWdlID0gbXNnPy5NZXNzYWdlO1xuICAgIGNvbnN0IHRhYklkID0gbXNnPy50YWJJZCA/PyBzLnRhYklkO1xuXG4gICAgLy8g5LuO57yT5a2Y5Lit5L+d5a2Y5pWw5o2u5Yiw5pys5ZywXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdwdXNoRGF0YScpIHtcbiAgICAgIHZvaWQgdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLmZvcmNlUGVyc2lzdCgpO1xuICAgICAgc2VuZFJlc3BvbnNlKCdvaycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g6I635Y+W5omA5pyJ5pWw5o2uXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdnZXRBbGxEYXRhJykge1xuICAgICAgc2VuZFJlc3BvbnNlKHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKS5nZXRBbGwoKSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDorr7nva7mianlsZXlm77moIfmlbDlrZdcbiAgICBpZiAoTWVzc2FnZSA9PT0gJ0NsZWFySWNvbicpIHtcbiAgICAgIG1zZy50eXBlID8gU2V0SWNvbih7IHRhYklkIH0pIDogU2V0SWNvbigpO1xuICAgICAgc2VuZFJlc3BvbnNlKCdvaycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g5ZCv55SoL+emgeeUqOaJqeWxlVxuICAgIGlmIChNZXNzYWdlID09PSAnZW5hYmxlJykge1xuICAgICAgdm9pZCBzLnNldEVuYWJsZSghcy5lbmFibGUpO1xuICAgICAgc2VuZFJlc3BvbnNlKHMuZW5hYmxlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIOaMiSByZXF1ZXN0SWQg5pWw57uE6I635Y+W5pWw5o2uXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdnZXREYXRhJyAmJiBtc2cucmVxdWVzdElkKSB7XG4gICAgICBjb25zdCBpZHMgPSBBcnJheS5pc0FycmF5KG1zZy5yZXF1ZXN0SWQpID8gbXNnLnJlcXVlc3RJZCA6IFttc2cucmVxdWVzdElkXTtcbiAgICAgIGNvbnN0IHJlc3BvbnNlID0gdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLmdldEJ5UmVxdWVzdElkcyhpZHMpO1xuICAgICAgc2VuZFJlc3BvbnNlKHJlc3BvbnNlLmxlbmd0aCA/IHJlc3BvbnNlIDogJ2Vycm9yJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDmjIkgdGFiSWQg6I635Y+W5pWw5o2uXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdnZXREYXRhJykge1xuICAgICAgc2VuZFJlc3BvbnNlKHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKS5nZXRCeVRhYih0YWJJZCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g6I635Y+W5oyJ6ZKu54q25oCBXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdnZXRCdXR0b25TdGF0ZScpIHtcbiAgICAgIGNvbnN0IHN0YXRlOiBSZWNvcmQ8c3RyaW5nLCBib29sZWFuPiA9IHtcbiAgICAgICAgTW9iaWxlVXNlckFnZW50OiBzLmZlYXRNb2JpbGVUYWJJZC5oYXModGFiSWQpLFxuICAgICAgICBBdXRvRG93bjogcy5mZWF0QXV0b0Rvd25UYWJJZC5oYXModGFiSWQpLFxuICAgICAgICBlbmFibGU6IHMuZW5hYmxlLFxuICAgICAgfTtcbiAgICAgIHMuc2NyaXB0TGlzdC5mb3JFYWNoKChpdGVtKSA9PiB7XG4gICAgICAgIHN0YXRlW2l0ZW0ua2V5XSA9IGl0ZW0udGFiSWQuaGFzKHRhYklkKTtcbiAgICAgIH0pO1xuICAgICAgc2VuZFJlc3BvbnNlKHN0YXRlKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIOiOt+WPluaJgOaciVwi5pyJIHZpZGVvIOeahCB0YWJcIuWIl+ihqCjov5jljp/ljp8gcG9wdXAuaHRtbCAjdmlkZW9UYWJJbmRleCDkuIvmi4nmlbDmja7mupBcbiAgICAvLyDop4EganMvbWVkaWEtY29udHJvbC5qcyB1cGRhdGVWaWRlb1RhZ09wdGlvbnMpXG4gICAgLy8g55So5LqOIHByZXZpZXcg6L+c56iL5qih5byP55qEXCLpgInmi6npobXpnaJcIuS4i+aLiVxuICAgIGlmIChNZXNzYWdlID09PSAnZ2V0VmlkZW9UYWJzJykge1xuICAgICAgY29uc3QgY29sbGVjdFRhYnMgPSBhc3luYyAodGFiczogY2hyb21lLnRhYnMuVGFiW10pID0+IHtcbiAgICAgICAgY29uc3QgcmVzdWx0OiBBcnJheTx7IGlkOiBudW1iZXI7IHRpdGxlOiBzdHJpbmc7IGZhdkljb25Vcmw/OiBzdHJpbmcgfT4gPSBbXTtcbiAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgdGFicy5tYXAoYXN5bmMgKHRhYikgPT4ge1xuICAgICAgICAgICAgaWYgKCF0YWIuaWQpIHJldHVybjtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIC8vIOeUqCB3ZWJOYXZpZ2F0aW9uLmdldEFsbEZyYW1lcyDojrflj5bmiYDmnIkgZnJhbWUo5Li7IGZyYW1lICsgaWZyYW1lKVxuICAgICAgICAgICAgICAvLyBjaHJvbWUudGFicy5zZW5kTWVzc2FnZSDpu5jorqTlj6rmlLbnrKzkuIDkuKogZnJhbWUg55qE5ZON5bqULFxuICAgICAgICAgICAgICAvLyDop4bpopHlj6/og73lnKggaWZyYW1lIOWGhSzpnIDpgY3ljobmiYDmnIkgZnJhbWUg5omN5LiN5ryPXG4gICAgICAgICAgICAgIGNvbnN0IGZyYW1lcyA9IGF3YWl0IGNocm9tZS53ZWJOYXZpZ2F0aW9uLmdldEFsbEZyYW1lcyh7IHRhYklkOiB0YWIuaWQgfSk7XG4gICAgICAgICAgICAgIGxldCBmb3VuZCA9IGZhbHNlO1xuICAgICAgICAgICAgICBpZiAoZnJhbWVzKSB7XG4gICAgICAgICAgICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoXG4gICAgICAgICAgICAgICAgICBmcmFtZXMubWFwKGFzeW5jIChmKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChmb3VuZCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHN0ID0gYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UoXG4gICAgICAgICAgICAgICAgICAgICAgICB0YWIuaWQhLFxuICAgICAgICAgICAgICAgICAgICAgICAgeyBNZXNzYWdlOiAnZ2V0VmlkZW9TdGF0ZScsIGluZGV4OiAwIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICB7IGZyYW1lSWQ6IGYuZnJhbWVJZCB9LFxuICAgICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICAgICAgaWYgKHN0ICYmIChzdCBhcyBhbnkpLmNvdW50ID4gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgICAgICAgICAgICAgICAgcmVzdWx0LnB1c2goe1xuICAgICAgICAgICAgICAgICAgICAgICAgICBpZDogdGFiLmlkISxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU6IHRhYi50aXRsZSA/PyAnJyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZmF2SWNvblVybDogdGFiLmZhdkljb25VcmwsXG4gICAgICAgICAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgICAgICAgICAgIC8qIGZyYW1lIOaXoCBjb250ZW50IHNjcmlwdCAvIOi3qOWfnyzot7Pov4cgKi9cbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgICAgIC8qIHdlYk5hdmlnYXRpb24g5LiN5Y+v55SoLOWbnumAgOWIsOWPquafpeS4uyBmcmFtZSAqL1xuICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIGNvbnN0IHN0ID0gYXdhaXQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UodGFiLmlkLCB7XG4gICAgICAgICAgICAgICAgICBNZXNzYWdlOiAnZ2V0VmlkZW9TdGF0ZScsXG4gICAgICAgICAgICAgICAgICBpbmRleDogMCxcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgICAgICBpZiAoc3QgJiYgKHN0IGFzIGFueSkuY291bnQgPiAwKSB7XG4gICAgICAgICAgICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICAgICAgICAgIGlkOiB0YWIuaWQsXG4gICAgICAgICAgICAgICAgICAgIHRpdGxlOiB0YWIudGl0bGUgPz8gJycsXG4gICAgICAgICAgICAgICAgICAgIGZhdkljb25Vcmw6IHRhYi5mYXZJY29uVXJsLFxuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGNhdGNoIHtcbiAgICAgICAgICAgICAgICAvKiDot7Pov4cgKi9cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pLFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfTtcbiAgICAgIGNocm9tZS50YWJzLnF1ZXJ5KHt9LCBhc3luYyAodGFicykgPT4ge1xuICAgICAgICBzZW5kUmVzcG9uc2UoYXdhaXQgY29sbGVjdFRhYnModGFicykpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDmqKHmi5/miYvmnLogVUFcbiAgICBpZiAoTWVzc2FnZSA9PT0gJ21vYmlsZVVzZXJBZ2VudCcpIHtcbiAgICAgIG1vYmlsZVVzZXJBZ2VudCh0YWJJZCwgIXMuZmVhdE1vYmlsZVRhYklkLmhhcyh0YWJJZCkpO1xuICAgICAgY2hyb21lLnRhYnMucmVsb2FkKHRhYklkLCB7IGJ5cGFzc0NhY2hlOiB0cnVlIH0pO1xuICAgICAgc2VuZFJlc3BvbnNlKCdvaycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g6Ieq5Yqo5LiL6L295byA5YWzXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdhdXRvRG93bicpIHtcbiAgICAgIGlmIChzLmZlYXRBdXRvRG93blRhYklkLmhhcyh0YWJJZCkpIHtcbiAgICAgICAgcy5yZW1vdmVGZWF0QXV0b0Rvd25UYWIodGFiSWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcy5hZGRGZWF0QXV0b0Rvd25UYWIodGFiSWQpO1xuICAgICAgfVxuICAgICAgc2VuZFJlc3BvbnNlKCdvaycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g6ISa5pys5rOo5YWl5oiW56e76ZmkXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdzY3JpcHQnKSB7XG4gICAgICBpZiAocy5vcHRpb25zLmRhbW4gJiYgcy5kYW1uVXJsU2V0Lmhhcyh0YWJJZCkpIHJldHVybjtcbiAgICAgIGlmICghcy5zY3JpcHRMaXN0Lmhhcyhtc2cuc2NyaXB0KSkge1xuICAgICAgICBzZW5kUmVzcG9uc2UoJ2Vycm9yIG5vIGV4aXN0cycpO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgICBjb25zdCBlbnRyeSA9IHMuc2NyaXB0TGlzdC5nZXQobXNnLnNjcmlwdCkhO1xuICAgICAgY29uc3QgcmVmcmVzaCA9IG1zZy5yZWZyZXNoID8/IGVudHJ5LnJlZnJlc2g7XG4gICAgICBpZiAoZW50cnkudGFiSWQuaGFzKHRhYklkKSkge1xuICAgICAgICBzLnRvZ2dsZVNjcmlwdFRhYihtc2cuc2NyaXB0LCB0YWJJZCk7XG4gICAgICAgIGlmIChtc2cuc2NyaXB0ID09PSAnc2VhcmNoLmpzJykge1xuICAgICAgICAgIHMuc2V0RGVlcFNlYXJjaENsb3NlKHRhYklkKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVmcmVzaCkgY2hyb21lLnRhYnMucmVsb2FkKHRhYklkLCB7IGJ5cGFzc0NhY2hlOiB0cnVlIH0pO1xuICAgICAgICBzZW5kUmVzcG9uc2UoJ29rJyk7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgICAgcy50b2dnbGVTY3JpcHRUYWIobXNnLnNjcmlwdCwgdGFiSWQpO1xuICAgICAgaWYgKHJlZnJlc2gpIHtcbiAgICAgICAgY2hyb21lLnRhYnMucmVsb2FkKHRhYklkLCB7IGJ5cGFzc0NhY2hlOiB0cnVlIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZmlsZXMgPSBbYGNhdGNoLXNjcmlwdC8ke21zZy5zY3JpcHR9YF07XG4gICAgICAgIGlmIChlbnRyeS5pMThuKSBmaWxlcy51bnNoaWZ0KCdjYXRjaC1zY3JpcHQvaTE4bi5qcycpO1xuICAgICAgICBjaHJvbWUuc2NyaXB0aW5nLmV4ZWN1dGVTY3JpcHQoe1xuICAgICAgICAgIHRhcmdldDogeyB0YWJJZCwgYWxsRnJhbWVzOiBlbnRyeS5hbGxGcmFtZXMgfSxcbiAgICAgICAgICBmaWxlcyxcbiAgICAgICAgICBpbmplY3RJbW1lZGlhdGVseTogdHJ1ZSxcbiAgICAgICAgICB3b3JsZDogZW50cnkud29ybGQgYXMgJ01BSU4nIHwgJ0lTT0xBVEVEJyxcbiAgICAgICAgfSkuY2F0Y2goKGUpID0+IGNvbnNvbGUuZXJyb3IoJ1tjYXQtY2F0Y2hdIHNjcmlwdCBpbmplY3QgZmFpbGVkOicsIG1zZy5zY3JpcHQsIGUpKTtcbiAgICAgIH1cbiAgICAgIHNlbmRSZXNwb25zZSgnb2snKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIOiEmuacrOeUs+ivt+WkmuivreiogFxuICAgIGlmIChNZXNzYWdlID09PSAnc2NyaXB0STE4bicpIHtcbiAgICAgIGNocm9tZS5zY3JpcHRpbmcuZXhlY3V0ZVNjcmlwdCh7XG4gICAgICAgIHRhcmdldDogeyB0YWJJZCwgYWxsRnJhbWVzOiB0cnVlIH0sXG4gICAgICAgIGZpbGVzOiBbJ2NhdGNoLXNjcmlwdC9pMThuLmpzJ10sXG4gICAgICAgIGluamVjdEltbWVkaWF0ZWx5OiB0cnVlLFxuICAgICAgICB3b3JsZDogJ01BSU4nLFxuICAgICAgfSk7XG4gICAgICBzZW5kUmVzcG9uc2UoJ29rJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBIZWFydCBCZWF0XG4gICAgaWYgKE1lc3NhZ2UgPT09ICdIZWFydEJlYXQnKSB7XG4gICAgICBjaHJvbWUudGFicy5xdWVyeSh7IGFjdGl2ZTogdHJ1ZSwgY3VycmVudFdpbmRvdzogdHJ1ZSB9LCAodGFicykgPT4ge1xuICAgICAgICBpZiAodGFic1swXT8uaWQpIHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKS5zZXRUYWJJZCh0YWJzWzBdLmlkKTtcbiAgICAgIH0pO1xuICAgICAgc2VuZFJlc3BvbnNlKCdIZWFydEJlYXQgT0snKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIOa4heeQhuaVsOaNrlxuICAgIGlmIChNZXNzYWdlID09PSAnY2xlYXJEYXRhJykge1xuICAgICAgY29uc3QgbSA9IHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKTtcbiAgICAgIGlmIChtc2cudHlwZSkge1xuICAgICAgICAvLyDlvZPliY3moIfnrb5cbiAgICAgICAgbS5jbGVhclRhYih0YWJJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyDlhbbku5bmoIfnrb5cbiAgICAgICAgbS5jbGVhck90aGVyVGFicyh0YWJJZCk7XG4gICAgICB9XG4gICAgICB2b2lkIG0ucGVyc2lzdCgpO1xuICAgICAgY2xlYXJSZWR1bmRhbnQoKTtcbiAgICAgIHNlbmRSZXNwb25zZSgnT0snKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIOa4heeQhuWGl+S9meaVsOaNrlxuICAgIGlmIChNZXNzYWdlID09PSAnY2xlYXJSZWR1bmRhbnQnKSB7XG4gICAgICBjbGVhclJlZHVuZGFudCgpO1xuICAgICAgc2VuZFJlc3BvbnNlKCdPSycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g5LuOIGNvbnRlbnQvY2F0Y2gtc2NyaXB0IOS8oOadpeeahCBhZGRNZWRpYVxuICAgIGlmIChNZXNzYWdlID09PSAnYWRkTWVkaWEnKSB7XG4gICAgICBjaHJvbWUudGFicy5xdWVyeSh7fSwgKHRhYnMpID0+IHtcbiAgICAgICAgbGV0IG1hdGNoZWRUYWJJZCA9IC0xO1xuICAgICAgICBmb3IgKGNvbnN0IHQgb2YgdGFicykge1xuICAgICAgICAgIGlmICh0LnVybCA9PT0gbXNnLmhyZWYpIHtcbiAgICAgICAgICAgIG1hdGNoZWRUYWJJZCA9IHQuaWQgPz8gLTE7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgZGF0YTogYW55ID0ge1xuICAgICAgICAgIHVybDogbXNnLnVybCxcbiAgICAgICAgICB0YWJJZDogbWF0Y2hlZFRhYklkID09PSAtMSA/IC0xIDogbWF0Y2hlZFRhYklkLFxuICAgICAgICAgIGV4dHJhRXh0OiBtc2cuZXh0cmFFeHQsXG4gICAgICAgICAgbWltZTogbXNnLm1pbWUsXG4gICAgICAgICAgcmVxdWVzdElkOiBtc2cucmVxdWVzdElkLFxuICAgICAgICAgIHJlcXVlc3RIZWFkZXJzOiBtc2cucmVxdWVzdEhlYWRlcnMsXG4gICAgICAgICAgaW5pdGlhdG9yOiBtYXRjaGVkVGFiSWQgPT09IC0xID8gbXNnLmhyZWYgOiB1bmRlZmluZWQsXG4gICAgICAgIH07XG4gICAgICAgIHZvaWQgZmluZE1lZGlhKGRhdGEsIHRydWUsIHRydWUpO1xuICAgICAgfSk7XG4gICAgICBzZW5kUmVzcG9uc2UoJ29rJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyBmZm1wZWcg572R6aG16YCa5L+hXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdjYXRDYXRjaEZGbXBlZycpIHtcbiAgICAgIGNvbnN0IGZmbXBlZyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKS5mZm1wZWdDb25maWc7XG4gICAgICBjb25zdCBwYXlsb2FkID0ge1xuICAgICAgICAuLi5tc2csXG4gICAgICAgIE1lc3NhZ2U6ICdmZm1wZWcnLFxuICAgICAgICB0YWJJZDogbXNnLnRhYklkID8/IHNlbmRlci50YWI/LmlkLFxuICAgICAgICB2ZXJzaW9uOiBmZm1wZWcudmVyc2lvbixcbiAgICAgIH07XG4gICAgICBjaHJvbWUudGFicy5xdWVyeSh7IHVybDogZmZtcGVnLnVybCArICcqJyB9LCAodGFicykgPT4ge1xuICAgICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yIHx8ICF0YWJzLmxlbmd0aCkge1xuICAgICAgICAgIGNocm9tZS50YWJzLmNyZWF0ZSh7IHVybDogZmZtcGVnLnVybCwgYWN0aXZlOiBtc2cuYWN0aXZlID8/IHRydWUgfSwgKHRhYikgPT4ge1xuICAgICAgICAgICAgaWYgKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvciB8fCAhdGFiIHx8ICF0YWIuaWQpIHJldHVybjtcbiAgICAgICAgICAgIGZmbXBlZy5jYWNoZURhdGEucHVzaChwYXlsb2FkKTtcbiAgICAgICAgICAgIGZmbXBlZy50YWIgPSB0YWIuaWQ7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGNvbnN0IGZpcnN0ID0gdGFic1swXTtcbiAgICAgICAgaWYgKGZpcnN0Py5zdGF0dXMgPT09ICdjb21wbGV0ZScgJiYgZmlyc3QuaWQpIHtcbiAgICAgICAgICB2b2lkIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKGZpcnN0LmlkLCBwYXlsb2FkKTtcbiAgICAgICAgfSBlbHNlIGlmIChmaXJzdD8uaWQpIHtcbiAgICAgICAgICBmZm1wZWcudGFiID0gZmlyc3QuaWQ7XG4gICAgICAgICAgZmZtcGVnLmNhY2hlRGF0YS5wdXNoKHBheWxvYWQpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICAgIHNlbmRSZXNwb25zZSgnb2snKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vID09PSBmZm1wZWcg6L2s56CB57uT5p6cKOi/mOWOn+WOnyBjb250ZW50LXNjcmlwdC5qcyDovazlj5EgKyDkuIvovb0pID09PVxuICAgIC8vIOWcqOe6vyBmZm1wZWcg5pyN5Yqh6L2s56CB5a6M5oiQIOKGkiBjb250ZW50LnRzIOWPkSBjYXRDYXRjaEZGbXBlZ1Jlc3VsdCDihpIgYmFja2dyb3VuZCDkuIvovb1cbiAgICBpZiAoTWVzc2FnZSA9PT0gJ2NhdENhdGNoRkZtcGVnUmVzdWx0Jykge1xuICAgICAgaWYgKG1zZy5zdGF0ZSA9PT0gJ2RvbmUnICYmIG1zZy5maWxlKSB7XG4gICAgICAgIC8vIG1zZy5maWxlIOaYryBibG9iOiBVUkwg5oiWIGRhdGE6IFVSTCznm7TmjqXkuIvovb1cbiAgICAgICAgY29uc3QgdGl0bGUgPSAobXNnLnRpdGxlIGFzIHN0cmluZykgfHwgYGNhdC1jYXRjaC1mZm1wZWctJHtEYXRlLm5vdygpfWA7XG4gICAgICAgIGNvbnN0IG91dHB1dCA9IChtc2cub3V0cHV0IGFzIHN0cmluZykgfHwgJ21wNCc7XG4gICAgICAgIGNocm9tZS5kb3dubG9hZHMuZG93bmxvYWQoe1xuICAgICAgICAgIHVybDogbXNnLmZpbGUgYXMgc3RyaW5nLFxuICAgICAgICAgIGZpbGVuYW1lOiBgJHt0aXRsZX0uJHtvdXRwdXR9YCxcbiAgICAgICAgICBzYXZlQXM6IGZhbHNlLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIC8vIOi9rOWPkee7meWPkei1t+iAhSB0YWIoY2F0Y2guanMgLyBtM3U4Lmh0bWwgLyBkb3dubG9hZGVyLmh0bWwg5Y+v6IO96ZyA6KaB5pu05pawIFVJKVxuICAgICAgaWYgKG1zZy50YWJJZCkge1xuICAgICAgICB2b2lkIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKG1zZy50YWJJZCBhcyBudW1iZXIsIHsgTWVzc2FnZTogJ2NhdENhdGNoRkZtcGVnUmVzdWx0JywgLi4ubXNnIH0pLmNhdGNoKCgpID0+IHt9KTtcbiAgICAgIH1cbiAgICAgIHNlbmRSZXNwb25zZSgnb2snKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIC8vIOaQuuW4puivt+axguWktOS4i+i9vSjov5jljp/ljp8gcG9wdXAuanMgY2F0RG93bmxvYWQgLT4gY3JlYXRlQ2F0RG93bmxvYWQpXG4gICAgLy8gcG9wdXAg5Y+R6YCBIGNhdERvd24g5raI5oGvO2JhY2tncm91bmQg5omT5byAIGRvd25sb2FkZXIuaHRtbCzpgJrov4cgSlNPTiDlj4LmlbBcbiAgICAvLyDkvKDpgJIgdXJsL25hbWUvcmVxdWVzdEhlYWRlcnMsZG93bmxvYWRlciDnlKggZmV0Y2goaGVhZGVycykg6JC955uYXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdjYXREb3duJykge1xuICAgICAgY29uc3QgZGF0YSA9IEFycmF5LmlzQXJyYXkobXNnLmRhdGEpID8gbXNnLmRhdGEgOiBbbXNnLmRhdGFdO1xuICAgICAgY29uc3QgcGF5bG9hZCA9IGRhdGEubWFwKChkOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikgPT4gKHtcbiAgICAgICAgdXJsOiBkLnVybCxcbiAgICAgICAgbmFtZTogZC5kb3duRmlsZU5hbWUgPz8gZC5uYW1lID8/ICcnLFxuICAgICAgICByZXF1ZXN0SGVhZGVyczogZC5yZXF1ZXN0SGVhZGVycyA/PyB7fSxcbiAgICAgICAgcmVxdWVzdElkOiBkLnJlcXVlc3RJZCxcbiAgICAgICAgdGFiSWQ6IGQudGFiSWQsXG4gICAgICB9KSk7XG4gICAgICBjaHJvbWUudGFicy5jcmVhdGUoe1xuICAgICAgICB1cmw6IGBkb3dubG9hZGVyLmh0bWw/SlNPTj0ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShwYXlsb2FkKSl9JmF1dG9DbG9zZT10cnVlYCxcbiAgICAgICAgYWN0aXZlOiB0cnVlLFxuICAgICAgfSk7XG4gICAgICBzZW5kUmVzcG9uc2UoJ29rJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDlj5HpgIHmlbDmja7liLDmnKzlnLAoc2VuZDJsb2NhbCDoh6rliqggLyBzZW5kMmxvY2FsTWFudWFsIOaJi+WKqOinpuWPkSlcbiAgICBpZiAoTWVzc2FnZSA9PT0gJ3NlbmQybG9jYWwnICYmIChzLm9wdGlvbnMuc2VuZDJsb2NhbCB8fCBzLm9wdGlvbnMuc2VuZDJsb2NhbE1hbnVhbCkpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZvaWQgc2VuZDJsb2NhbChtc2cuYWN0aW9uID8/ICdjYXRjaCcsIG1zZy5kYXRhLCBtc2cudGFiSWQpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgfVxuICAgICAgc2VuZFJlc3BvbnNlKCdvaycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g5Y+R6YCB5YiwIEFyaWEyKOi/mOWOn+WOnyBwb3B1cC11dGlscy5qcyBhcmlhMkFkZFVyaSlcbiAgICBpZiAoTWVzc2FnZSA9PT0gJ2FyaWEyJyAmJiBzLm9wdGlvbnMuZW5hYmxlQXJpYTJScGMpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHZvaWQgYXJpYTJBZGRVcmkobXNnLmRhdGEpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBjb25zb2xlLmVycm9yKGUpO1xuICAgICAgfVxuICAgICAgc2VuZFJlc3BvbnNlKCdvaycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g6LCD55So5pys5Zyw56iL5bqPKOi/mOWOn+WOnyBwb3B1cC5qcyBpbnZva2U6dGVtcGxhdGVzIOa4suafk+WQjuWvvOiIqilcbiAgICBpZiAoTWVzc2FnZSA9PT0gJ2ludm9rZScgJiYgcy5vcHRpb25zLmludm9rZSkge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgdXJsID0gdGVtcGxhdGVzKHMub3B0aW9ucy5pbnZva2VUZXh0LCBtc2cuZGF0YSBhcyBUZW1wbGF0ZUNvbnRleHQpO1xuICAgICAgICBjb25zdCB0YXJnZXRUYWJJZCA9IG1zZy50YWJJZCA/PyB0YWJJZDtcbiAgICAgICAgaWYgKHRhcmdldFRhYklkID4gMCkge1xuICAgICAgICAgIGNocm9tZS50YWJzLnVwZGF0ZSh0YXJnZXRUYWJJZCwgeyB1cmwgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMudXBkYXRlKHsgdXJsIH0pO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICB9XG4gICAgICBzZW5kUmVzcG9uc2UoJ29rJyk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICAvLyDlj5HpgIHliLAgTVFUVCjnroDljJblrp7njrA6U1cg5Lit5pegIG1xdHQuanMg5bqTLOS7heiusOW9leaXpeW/lylcbiAgICBpZiAoTWVzc2FnZSA9PT0gJ21xdHQnICYmIHMub3B0aW9ucy5tcXR0RW5hYmxlKSB7XG4gICAgICBjb25zb2xlLndhcm4oJ1tjYXQtY2F0Y2hdIE1RVFQg5Y+R6YCB6ZyA5ZyoIHBvcHVwL3ByZXZpZXcg56uv6LCD55SoKOS+nei1liBtcXR0LmpzIOW6kyksYmFja2dyb3VuZCDlt7LorrDlvZU6JywgbXNnLmRhdGEpO1xuICAgICAgc2VuZFJlc3BvbnNlKCdvaycpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8gZGFtblVybCDmn6Xor6JcbiAgICBpZiAoTWVzc2FnZSA9PT0gJ2RhbW5VcmxIYXMnKSB7XG4gICAgICBzZW5kUmVzcG9uc2Uocy5kYW1uVXJsU2V0Lmhhcyh0YWJJZCkpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgLy8g5YWz6Zet6ISa5pysXG4gICAgaWYgKE1lc3NhZ2UgPT09ICdjbG9zZVNjcmlwdCcpIHtcbiAgICAgIGlmICghbXNnLnNjcmlwdCB8fCAhcy5zY3JpcHRMaXN0Lmhhcyhtc2cuc2NyaXB0KSkge1xuICAgICAgICBzZW5kUmVzcG9uc2UoJ2Vycm9yJyk7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHMudG9nZ2xlU2NyaXB0VGFiKG1zZy5zY3JpcHQsIHRhYklkKTtcbiAgICAgIHNlbmRSZXNwb25zZSgnb2snKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybjtcbiAgfSk7XG5cbiAgLy8gPT09PT0gb25NZXNzYWdlRXh0ZXJuYWwo6L+Y5Y6fIGJhY2tncm91bmQuanMg56ysIDU5MC02MDMg6KGMKSA9PT09PVxuICBjaHJvbWUucnVudGltZS5vbk1lc3NhZ2VFeHRlcm5hbC5hZGRMaXN0ZW5lcigocmVxdWVzdCwgX3NlbmRlciwgc2VuZFJlc3BvbnNlKSA9PiB7XG4gICAgY29uc3QgcyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKTtcbiAgICBpZiAocmVxdWVzdC5hY3Rpb24gPT09ICdnZXREYXRhJykge1xuICAgICAgaWYgKHJlcXVlc3QudGFiSWQpIHtcbiAgICAgICAgc2VuZFJlc3BvbnNlKHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKS5nZXRCeVRhYihyZXF1ZXN0LnRhYklkKSA/PyBudWxsKTtcbiAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICB9XG4gICAgICBzZW5kUmVzcG9uc2UodXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLmdldEFsbCgpKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBpZiAocmVxdWVzdC5hY3Rpb24gPT09ICdnZXRDdXJyZW50VGFiRGF0YScpIHtcbiAgICAgIGNvbnN0IHRhYklkID0gcmVxdWVzdC50YWJJZCA/PyBzLnRhYklkO1xuICAgICAgc2VuZFJlc3BvbnNlKHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKS5nZXRCeVRhYih0YWJJZCkgPz8gbnVsbCk7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuO1xuICB9KTtcblxuICAvLyA9PT09PSDmoIfnrb7liIfmjaIo6L+Y5Y6fIGJhY2tncm91bmQuanMg56ysIDYxNS02MjIg6KGMKSA9PT09PVxuICBjaHJvbWUudGFicy5vbkFjdGl2YXRlZC5hZGRMaXN0ZW5lcigoYWN0aXZlSW5mbykgPT4ge1xuICAgIHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKS5zZXRUYWJJZChhY3RpdmVJbmZvLnRhYklkKTtcbiAgICBjb25zdCBsaXN0ID0gdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLmdldEJ5VGFiKGFjdGl2ZUluZm8udGFiSWQpO1xuICAgIFNldEljb24oeyBudW1iZXI6IGxpc3QubGVuZ3RoLCB0YWJJZDogYWN0aXZlSW5mby50YWJJZCB9KTtcbiAgfSk7XG5cbiAgLy8gPT09PT0g56qX5Y+j5YiH5o2iKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA2MjUtNjM0IOihjCkgPT09PT1cbiAgY2hyb21lLndpbmRvd3Mub25Gb2N1c0NoYW5nZWQuYWRkTGlzdGVuZXIoKHdpbmRvd0lkKSA9PiB7XG4gICAgaWYgKHdpbmRvd0lkID09PSAtMSkgcmV0dXJuO1xuICAgIGNocm9tZS50YWJzLnF1ZXJ5KHsgYWN0aXZlOiB0cnVlLCB3aW5kb3dJZCB9LCAodGFicykgPT4ge1xuICAgICAgaWYgKHRhYnNbMF0/LmlkKSB7XG4gICAgICAgIHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKS5zZXRUYWJJZCh0YWJzWzBdLmlkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKS5zZXRUYWJJZCgtMSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vID09PT09IOagh+etvuabtOaWsCjov5jljp8gYmFja2dyb3VuZC5qcyDnrKwgNjQxLTY3MiDooYwpID09PT09XG4gIGNocm9tZS50YWJzLm9uVXBkYXRlZC5hZGRMaXN0ZW5lcigodGFiSWQsIGNoYW5nZUluZm8sIHRhYikgPT4ge1xuICAgIGNvbnN0IHMgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCk7XG4gICAgaWYgKGlzU3BlY2lhbFBhZ2UodGFiLnVybCkgfHwgdGFiSWQgPD0gMCB8fCAhcy5pbml0U3luY0NvbXBsZXRlKSByZXR1cm47XG5cbiAgICAvLyDoh6rliqjmuIXnkIYgbW9kZSA9PSAyXG4gICAgaWYgKGNoYW5nZUluZm8uc3RhdHVzICYmIGNoYW5nZUluZm8uc3RhdHVzID09PSAnbG9hZGluZycgJiYgcy5vcHRpb25zLmF1dG9DbGVhck1vZGUgPT09IDIpIHtcbiAgICAgIHVzZVJ1bnRpbWVTdG9yZS5nZXRTdGF0ZSgpLmNsZWFyVGFiVXJscyh0YWJJZCk7XG4gICAgICBjaHJvbWUuYWxhcm1zLmdldCgnc2F2ZScsIChhbGFybSkgPT4ge1xuICAgICAgICBpZiAoIWFsYXJtKSB7XG4gICAgICAgICAgdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLmNsZWFyVGFiKHRhYklkKTtcbiAgICAgICAgICBTZXRJY29uKHsgdGFiSWQgfSk7XG4gICAgICAgICAgY2hyb21lLmFsYXJtcy5jcmVhdGUoJ3NhdmUnLCB7IHdoZW46IERhdGUubm93KCkgKyAxMDAwIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyDmo4Dmn6UgYmxvY2tVcmwgLyBkYW1uVXJsIOWIl+ihqFxuICAgIGlmIChjaGFuZ2VJbmZvLnVybCAmJiB0YWJJZCA+IDApIHtcbiAgICAgIGlmIChzLmJsb2NrVXJsLmxlbmd0aCkge1xuICAgICAgICBpZiAoaXNMb2NrVXJsKGNoYW5nZUluZm8udXJsKSkge1xuICAgICAgICAgIHMuYWRkQmxvY2tVcmxUYWIodGFiSWQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHMucmVtb3ZlQmxvY2tVcmxUYWIodGFiSWQpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBpZiAoaXNEYW1uVXJsKGNoYW5nZUluZm8udXJsKSkge1xuICAgICAgICBzLmFkZERhbW5VcmxUYWIodGFiSWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcy5yZW1vdmVEYW1uVXJsVGFiKHRhYklkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBzaWRlUGFuZWwg6YWN572uXG4gICAgdHJ5IHtcbiAgICAgIHZvaWQgY2hyb21lLnNpZGVQYW5lbD8uc2V0T3B0aW9ucyh7XG4gICAgICAgIHRhYklkLFxuICAgICAgICBwYXRoOiBgcG9wdXAuaHRtbD90YWJJZD0ke3RhYklkfWAsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIHtcbiAgICAgIC8qIHNpZGVQYW5lbCDlj6/og73lnKggU1cg5LiN5Y+v55SoICovXG4gICAgfVxuICB9KTtcblxuICAvLyA9PT09PSB3ZWJOYXZpZ2F0aW9uLm9uQ29tbWl0dGVkKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA2ODAtNzM5IOihjCkgPT09PT1cbiAgY2hyb21lLndlYk5hdmlnYXRpb24ub25Db21taXR0ZWQuYWRkTGlzdGVuZXIoKGRldGFpbHMpID0+IHtcbiAgICBjb25zdCBzID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICAgIGlmIChpc1NwZWNpYWxQYWdlKGRldGFpbHMudXJsKSB8fCBkZXRhaWxzLnRhYklkIDw9IDAgfHwgIXMuaW5pdFN5bmNDb21wbGV0ZSkgcmV0dXJuO1xuXG4gICAgaWYgKGRldGFpbHMuZnJhbWVJZCA9PT0gMCkge1xuICAgICAgLy8g5Li75qGG5p62OumHjeaWsOajgOafpSBibG9ja1VybC9kYW1uXG4gICAgICBpZiAoaXNMb2NrVXJsKGRldGFpbHMudXJsKSkge1xuICAgICAgICBzLmFkZEJsb2NrVXJsVGFiKGRldGFpbHMudGFiSWQpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcy5yZW1vdmVCbG9ja1VybFRhYihkZXRhaWxzLnRhYklkKTtcbiAgICAgIH1cbiAgICAgIGlmIChpc0RhbW5VcmwoZGV0YWlscy51cmwpKSB7XG4gICAgICAgIHMuYWRkRGFtblVybFRhYihkZXRhaWxzLnRhYklkKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHMucmVtb3ZlRGFtblVybFRhYihkZXRhaWxzLnRhYklkKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyDkuLvmoYbmnrYgKyDpnZ4gc3ViZnJhbWUvZm9ybV9zdWJtaXQgdHJhbnNpdGlvbiArIGF1dG9DbGVhck1vZGUgPT0gMSAtPiDmuIXnqbpcbiAgICBjb25zdCBza2lwVHJhbnNpdGlvbnMgPSBbJ2F1dG9fc3ViZnJhbWUnLCAnbWFudWFsX3N1YmZyYW1lJywgJ2Zvcm1fc3VibWl0J107XG4gICAgaWYgKFxuICAgICAgZGV0YWlscy5mcmFtZUlkID09PSAwICYmXG4gICAgICAhc2tpcFRyYW5zaXRpb25zLmluY2x1ZGVzKGRldGFpbHMudHJhbnNpdGlvblR5cGUpICYmXG4gICAgICBzLm9wdGlvbnMuYXV0b0NsZWFyTW9kZSA9PT0gMVxuICAgICkge1xuICAgICAgdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLmNsZWFyVGFiKGRldGFpbHMudGFiSWQpO1xuICAgICAgdXNlUnVudGltZVN0b3JlLmdldFN0YXRlKCkuY2xlYXJUYWJVcmxzKGRldGFpbHMudGFiSWQpO1xuICAgICAgdm9pZCB1c2VNZWRpYVN0b3JlLmdldFN0YXRlKCkucGVyc2lzdCgpO1xuICAgICAgU2V0SWNvbih7IHRhYklkOiBkZXRhaWxzLnRhYklkIH0pO1xuICAgIH1cblxuICAgIC8vIGNocm9tZSAxMDIg5Lul5LiL5LiN5pSv5oyBIHNjcmlwdGluZ1xuICAgIGlmIChzLnZlcnNpb24gPCAxMDIpIHJldHVybjtcblxuICAgIC8vIOa3seW6puaQnOe0ouazqOWFpVxuICAgIGlmIChcbiAgICAgICFzLmJsb2NrVXJsU2V0LmhhcyhkZXRhaWxzLnRhYklkKSAmJlxuICAgICAgcy5vcHRpb25zLmRlZXBTZWFyY2ggJiZcbiAgICAgIHMuZGVlcFNlYXJjaFRlbXBvcmFyaWx5Q2xvc2UgIT09IGRldGFpbHMudGFiSWRcbiAgICApIHtcbiAgICAgIHMudG9nZ2xlU2NyaXB0VGFiKCdzZWFyY2guanMnLCBkZXRhaWxzLnRhYklkKTtcbiAgICAgIHMuc2V0RGVlcFNlYXJjaENsb3NlKG51bGwpO1xuICAgIH1cblxuICAgIC8vIGNhdGNoLXNjcmlwdCDms6jlhaVcbiAgICBzLnNjcmlwdExpc3QuZm9yRWFjaCgoZW50cnksIHNjcmlwdCkgPT4ge1xuICAgICAgaWYgKCFlbnRyeS50YWJJZC5oYXMoZGV0YWlscy50YWJJZCkgfHwgIWVudHJ5LmFsbEZyYW1lcykgcmV0dXJuO1xuICAgICAgY29uc3QgZmlsZXMgPSBbYGNhdGNoLXNjcmlwdC8ke3NjcmlwdH1gXTtcbiAgICAgIGlmIChlbnRyeS5pMThuKSBmaWxlcy51bnNoaWZ0KCdjYXRjaC1zY3JpcHQvaTE4bi5qcycpO1xuICAgICAgY2hyb21lLnNjcmlwdGluZy5leGVjdXRlU2NyaXB0KHtcbiAgICAgICAgdGFyZ2V0OiB7IHRhYklkOiBkZXRhaWxzLnRhYklkLCBmcmFtZUlkczogW2RldGFpbHMuZnJhbWVJZF0gfSxcbiAgICAgICAgZmlsZXMsXG4gICAgICAgIGluamVjdEltbWVkaWF0ZWx5OiB0cnVlLFxuICAgICAgICB3b3JsZDogZW50cnkud29ybGQgYXMgJ01BSU4nIHwgJ0lTT0xBVEVEJyxcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgLy8g5qih5ouf5omL5py6IFVBXG4gICAgaWYgKHMuaW5pdExvY2FsQ29tcGxldGUgJiYgcy5mZWF0TW9iaWxlVGFiSWQuc2l6ZSA+IDAgJiYgcy5mZWF0TW9iaWxlVGFiSWQuaGFzKGRldGFpbHMudGFiSWQpKSB7XG4gICAgICBjaHJvbWUuc2NyaXB0aW5nLmV4ZWN1dGVTY3JpcHQoe1xuICAgICAgICBhcmdzOiBbcy5vcHRpb25zLk1vYmlsZVVzZXJBZ2VudC50b1N0cmluZygpXSxcbiAgICAgICAgdGFyZ2V0OiB7IHRhYklkOiBkZXRhaWxzLnRhYklkLCBmcmFtZUlkczogW2RldGFpbHMuZnJhbWVJZF0gfSxcbiAgICAgICAgZnVuYzogZnVuY3Rpb24gKCkge1xuICAgICAgICAgIC8vIEB0cy1pZ25vcmUgcnVudGltZSBpbmplY3RlZFxuICAgICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShuYXZpZ2F0b3IsICd1c2VyQWdlbnQnLCB7XG4gICAgICAgICAgICB2YWx1ZTogKGFyZ3VtZW50cyBhcyB1bmtub3duIGFzIFtzdHJpbmddKVswXSxcbiAgICAgICAgICAgIHdyaXRhYmxlOiBmYWxzZSxcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSxcbiAgICAgICAgaW5qZWN0SW1tZWRpYXRlbHk6IHRydWUsXG4gICAgICAgIHdvcmxkOiAnTUFJTicsXG4gICAgICB9IGFzIGFueSk7XG4gICAgfVxuICB9KTtcblxuICAvLyA9PT09PSDmoIfnrb7lhbPpl60o6L+Y5Y6fIGJhY2tncm91bmQuanMg56ysIDc0NC03NTMg6KGMKSA9PT09PVxuICBjaHJvbWUudGFicy5vblJlbW92ZWQuYWRkTGlzdGVuZXIoKHRhYklkKSA9PiB7XG4gICAgY2hyb21lLmFsYXJtcy5nZXQoJ25vd0NsZWFyJywgKGFsYXJtKSA9PiB7XG4gICAgICBpZiAoIWFsYXJtKSB7XG4gICAgICAgIGNocm9tZS5hbGFybXMuY3JlYXRlKCdub3dDbGVhcicsIHsgd2hlbjogRGF0ZS5ub3coKSArIDEwMDAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgY29uc3QgcyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKTtcbiAgICBpZiAocy5pbml0U3luY0NvbXBsZXRlKSB7XG4gICAgICBpZiAocy5ibG9ja1VybFNldC5oYXModGFiSWQpKSBzLnJlbW92ZUJsb2NrVXJsVGFiKHRhYklkKTtcbiAgICAgIGlmIChzLmRhbW5VcmxTZXQuaGFzKHRhYklkKSkgcy5yZW1vdmVEYW1uVXJsVGFiKHRhYklkKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vID09PT09IOmhtemdouWKoOi9veWujOaIkDpmZm1wZWcg5pWw5o2u5Zue6YCBKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA4MzItODQyIOihjCkgPT09PT1cbiAgY2hyb21lLndlYk5hdmlnYXRpb24ub25Db21wbGV0ZWQuYWRkTGlzdGVuZXIoKGRldGFpbHMpID0+IHtcbiAgICBjb25zdCBzID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICAgIGlmIChzLmZmbXBlZ0NvbmZpZy50YWIgJiYgZGV0YWlscy50YWJJZCA9PT0gcy5mZm1wZWdDb25maWcudGFiKSB7XG4gICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgY29uc3QgY2FjaGUgPSBzLmZmbXBlZ0NvbmZpZy5jYWNoZURhdGE7XG4gICAgICAgIGZvciAoY29uc3QgZGF0YSBvZiBjYWNoZSkge1xuICAgICAgICAgIHZvaWQgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UoZGV0YWlscy50YWJJZCwgZGF0YSk7XG4gICAgICAgIH1cbiAgICAgICAgcy5mZm1wZWdDb25maWcuY2FjaGVEYXRhLmxlbmd0aCA9IDA7XG4gICAgICAgIHMuZmZtcGVnQ29uZmlnLnRhYiA9IDA7XG4gICAgICB9LCA1MDApO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gPT09PT0g5LiL6L295aSx6LSl5YWc5bqVOuWbvueJh+S4i+i9veWksei0peaXtuaUuei1sCBkb3dubG9hZGVyKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA4MDQtODEyIOihjCkgPT09PT1cbiAgY2hyb21lLmRvd25sb2Fkcy5vbkNoYW5nZWQuYWRkTGlzdGVuZXIoKGl0ZW0pID0+IHtcbiAgICBjb25zdCBzID0gdXNlU2V0dGluZ3NTdG9yZS5nZXRTdGF0ZSgpO1xuICAgIGlmIChzLm9wdGlvbnMuY2F0RG93bmxvYWQpIHtcbiAgICAgIGRvd25EYXRhSW1hZ2VTYXZlID0gdW5kZWZpbmVkO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBjb25zdCBlcnJvckxpc3QgPSBbXG4gICAgICAnU0VSVkVSX0JBRF9DT05URU5UJywgJ1NFUlZFUl9VTkFVVEhPUklaRUQnLCAnU0VSVkVSX0ZPUkJJRERFTicsXG4gICAgICAnU0VSVkVSX1VOUkVBQ0hBQkxFJywgJ1NFUlZFUl9DUk9TU19PUklHSU5fUkVESVJFQ1QnLCAnU0VSVkVSX0ZBSUxFRCcsXG4gICAgICAnTkVUV09SS19GQUlMRUQnLFxuICAgIF07XG4gICAgaWYgKGl0ZW0uZXJyb3IgJiYgaXRlbS5lcnJvci5jdXJyZW50ICYmIGVycm9yTGlzdC5pbmNsdWRlcyhpdGVtLmVycm9yLmN1cnJlbnQpICYmIGRvd25EYXRhSW1hZ2VTYXZlKSB7XG4gICAgICBjb25zdCBkYXRhID0ge1xuICAgICAgICByZXF1ZXN0SGVhZGVyczogeyByZWZlcmVyOiBkb3duRGF0YUltYWdlU2F2ZS5wYWdlVXJsID8/ICcnIH0sXG4gICAgICAgIHJlcXVlc3RJZDogcy50YWJJZCxcbiAgICAgICAgdXJsOiBkb3duRGF0YUltYWdlU2F2ZS5zcmNVcmwgPz8gJycsXG4gICAgICB9O1xuICAgICAgY2hyb21lLnRhYnMuY3JlYXRlKHtcbiAgICAgICAgdXJsOiBgZG93bmxvYWRlci5odG1sP0pTT049JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoZGF0YSkpfSZhdXRvQ2xvc2U9dHJ1ZWAsXG4gICAgICAgIGFjdGl2ZTogZmFsc2UsXG4gICAgICB9KTtcbiAgICAgIGRvd25EYXRhSW1hZ2VTYXZlID0gdW5kZWZpbmVkO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gPT09PT0g5Y+z6ZSu6I+c5Y2V5Yib5bu6KOi/mOWOn+WOnyBpbml0LmpzIEwzODUtNDMxIGNvbnRleHRNZW51c0luaXQpID09PT09XG4gIC8vIOeugOWMljrniLboj5zljZXlp4vnu4jlj6/op4Eo5Y6f6aG555uu55SoIHZpc2libGUg5Y+C5pWw5o6n5Yi2KVxuICBmdW5jdGlvbiBjb250ZXh0TWVudXNJbml0KCk6IHZvaWQge1xuICAgIGlmICghY2hyb21lLmNvbnRleHRNZW51cykgcmV0dXJuO1xuICAgIGNocm9tZS5jb250ZXh0TWVudXMucmVtb3ZlQWxsKCgpID0+IHtcbiAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHJldHVybjtcbiAgICAgIGNocm9tZS5jb250ZXh0TWVudXMuY3JlYXRlKHtcbiAgICAgICAgaWQ6ICdjYXQtY2F0Y2gnLFxuICAgICAgICB0aXRsZTogaTE4bignY2F0Q2F0Y2gnKSxcbiAgICAgICAgY29udGV4dHM6IFsncGFnZScsICdpbWFnZSddLFxuICAgICAgfSk7XG4gICAgICBjaHJvbWUuY29udGV4dE1lbnVzLmNyZWF0ZSh7XG4gICAgICAgIGlkOiAnaW1hZ2Utc2F2ZScsXG4gICAgICAgIHBhcmVudElkOiAnY2F0LWNhdGNoJyxcbiAgICAgICAgdGl0bGU6IGkxOG4oJ3NhdmUnKSxcbiAgICAgICAgY29udGV4dHM6IFsnaW1hZ2UnXSxcbiAgICAgIH0pO1xuICAgICAgY2hyb21lLmNvbnRleHRNZW51cy5jcmVhdGUoe1xuICAgICAgICBpZDogJ2VuYWJsZScsXG4gICAgICAgIHBhcmVudElkOiAnY2F0LWNhdGNoJyxcbiAgICAgICAgdGl0bGU6IGAke2kxOG4oJ2VuYWJsZScpfSAvICR7aTE4bignZGlzYWJsZScpfWAsXG4gICAgICAgIGNvbnRleHRzOiBbJ3BhZ2UnLCAnaW1hZ2UnXSxcbiAgICAgIH0pO1xuICAgICAgY2hyb21lLmNvbnRleHRNZW51cy5jcmVhdGUoe1xuICAgICAgICBpZDogJ3ByZXZpZXcnLFxuICAgICAgICBwYXJlbnRJZDogJ2NhdC1jYXRjaCcsXG4gICAgICAgIHRpdGxlOiBpMThuKCdwcmV2aWV3JyksXG4gICAgICAgIGNvbnRleHRzOiBbJ3BhZ2UnLCAnaW1hZ2UnXSxcbiAgICAgIH0pO1xuICAgICAgY2hyb21lLmNvbnRleHRNZW51cy5jcmVhdGUoe1xuICAgICAgICBpZDogJ2RlZXBTZWFyY2gnLFxuICAgICAgICBwYXJlbnRJZDogJ2NhdC1jYXRjaCcsXG4gICAgICAgIHRpdGxlOiBpMThuKCdkZWVwU2VhcmNoJyksXG4gICAgICAgIGNvbnRleHRzOiBbJ3BhZ2UnLCAnaW1hZ2UnXSxcbiAgICAgIH0pO1xuICAgICAgY2hyb21lLmNvbnRleHRNZW51cy5jcmVhdGUoe1xuICAgICAgICBpZDogJ2NhdGNoJyxcbiAgICAgICAgcGFyZW50SWQ6ICdjYXQtY2F0Y2gnLFxuICAgICAgICB0aXRsZTogaTE4bignY2FjaGVDYXB0dXJlJyksXG4gICAgICAgIGNvbnRleHRzOiBbJ3BhZ2UnLCAnaW1hZ2UnXSxcbiAgICAgIH0pO1xuICAgICAgY2hyb21lLmNvbnRleHRNZW51cy5jcmVhdGUoe1xuICAgICAgICBpZDogJ2F1dG9fZG93bicsXG4gICAgICAgIHBhcmVudElkOiAnY2F0LWNhdGNoJyxcbiAgICAgICAgdGl0bGU6IGkxOG4oJ2F1dG9Eb3dubG9hZCcpLFxuICAgICAgICBjb250ZXh0czogWydwYWdlJywgJ2ltYWdlJ10sXG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vID09PT09IEFyaWEyIFJQQyDlj5HpgIEo6L+Y5Y6f5Y6fIHBvcHVwLXV0aWxzLmpzIGFyaWEyQWRkVXJpKSA9PT09PVxuICBhc3luYyBmdW5jdGlvbiBhcmlhMkFkZFVyaShkYXRhOiBhbnkpOiBQcm9taXNlPGFueT4ge1xuICAgIGNvbnN0IG9wdHMgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCkub3B0aW9ucztcbiAgICBjb25zdCBqc29uOiBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPiA9IHtcbiAgICAgIGpzb25ycGM6ICcyLjAnLFxuICAgICAgaWQ6ICdjYXQtY2F0Y2gtJyArIChkYXRhPy5yZXF1ZXN0SWQgfHwgRGF0ZS5ub3coKSksXG4gICAgICBtZXRob2Q6ICdhcmlhMi5hZGRVcmknLFxuICAgICAgcGFyYW1zOiBbXSBhcyB1bmtub3duW10sXG4gICAgfTtcbiAgICBjb25zdCBwYXJhbXM6IHVua25vd25bXSA9IGpzb24ucGFyYW1zIGFzIHVua25vd25bXTtcbiAgICBpZiAob3B0cy5hcmlhMlJwY1Rva2VuKSB7XG4gICAgICBwYXJhbXMucHVzaChgdG9rZW46JHtvcHRzLmFyaWEyUnBjVG9rZW59YCk7XG4gICAgfVxuICAgIGNvbnN0IG9wdGlvbnM6IFJlY29yZDxzdHJpbmcsIHVua25vd24+ID0ge307XG4gICAgaWYgKGRhdGE/LmRvd25GaWxlTmFtZSkge1xuICAgICAgb3B0aW9ucy5vdXQgPSBkYXRhLmRvd25GaWxlTmFtZTtcbiAgICB9XG4gICAgaWYgKG9wdHMuYXJpYTJScGNEaXIpIHtcbiAgICAgIG9wdGlvbnMuZGlyID0gb3B0cy5hcmlhMlJwY0RpcjtcbiAgICB9XG4gICAgaWYgKG9wdHMuZW5hYmxlQXJpYTJScGNSZWZlcmVyKSB7XG4gICAgICBjb25zdCBoZWFkZXJzOiBzdHJpbmdbXSA9IFtdO1xuICAgICAgaGVhZGVycy5wdXNoKCdVc2VyLUFnZW50OiAnICsgKG9wdHMudXNlckFnZW50IHx8IG5hdmlnYXRvci51c2VyQWdlbnQpKTtcbiAgICAgIGlmIChkYXRhPy5yZXF1ZXN0SGVhZGVycz8ucmVmZXJlcikge1xuICAgICAgICBoZWFkZXJzLnB1c2goJ1JlZmVyZXI6ICcgKyBkYXRhLnJlcXVlc3RIZWFkZXJzLnJlZmVyZXIpO1xuICAgICAgfVxuICAgICAgaWYgKGRhdGE/LmNvb2tpZSkge1xuICAgICAgICBoZWFkZXJzLnB1c2goJ0Nvb2tpZTogJyArIGRhdGEuY29va2llKTtcbiAgICAgIH1cbiAgICAgIGlmIChkYXRhPy5yZXF1ZXN0SGVhZGVycz8uYXV0aG9yaXphdGlvbikge1xuICAgICAgICBoZWFkZXJzLnB1c2goJ0F1dGhvcml6YXRpb246ICcgKyBkYXRhLnJlcXVlc3RIZWFkZXJzLmF1dGhvcml6YXRpb24pO1xuICAgICAgfVxuICAgICAgb3B0aW9ucy5oZWFkZXIgPSBoZWFkZXJzO1xuICAgIH1cbiAgICBwYXJhbXMucHVzaChbZGF0YT8udXJsXSwgb3B0aW9ucyk7XG4gICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2gob3B0cy5hcmlhMlJwYywge1xuICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICBoZWFkZXJzOiB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD11dGYtOCcgfSxcbiAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KGpzb24pLFxuICAgIH0pO1xuICAgIHJldHVybiBhd2FpdCByZXMuanNvbigpO1xuICB9XG5cbiAgLy8gPT09PT0g5Y+z6ZSu6I+c5Y2V5LiO5b+r5o236ZSu5aSN55SoKOi/mOWOnyBiYWNrZ3JvdW5kLmpzIOesrCA3NTYtODAzIOihjCkgPT09PT1cbiAgZnVuY3Rpb24gcnVuQ29tbWFuZHMoY29tbWFuZDogc3RyaW5nLCBkYXRhPzogYW55KTogdm9pZCB7XG4gICAgY29uc3QgcyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKTtcbiAgICBjb25zdCB0YWJJZCA9IHMudGFiSWQ7XG4gICAgc3dpdGNoIChjb21tYW5kKSB7XG4gICAgICBjYXNlICdhdXRvX2Rvd24nOiB7XG4gICAgICAgIGlmIChzLmZlYXRBdXRvRG93blRhYklkLmhhcyh0YWJJZCkpIHtcbiAgICAgICAgICBzLnJlbW92ZUZlYXRBdXRvRG93blRhYih0YWJJZCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy5hZGRGZWF0QXV0b0Rvd25UYWIodGFiSWQpO1xuICAgICAgICB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgY2FzZSAnY2F0Y2gnOiB7XG4gICAgICAgIHMudG9nZ2xlU2NyaXB0VGFiKCdjYXRjaC5qcycsIHRhYklkKTtcbiAgICAgICAgY2hyb21lLnRhYnMucmVsb2FkKHRhYklkLCB7IGJ5cGFzc0NhY2hlOiB0cnVlIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ20zdTgnOlxuICAgICAgICB2b2lkIGNocm9tZS50YWJzLmNyZWF0ZSh7IHVybDogJ20zdTguaHRtbCcgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnY2xlYXInOiB7XG4gICAgICAgIHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKS5jbGVhclRhYih0YWJJZCk7XG4gICAgICAgIHZvaWQgdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLnBlcnNpc3QoKTtcbiAgICAgICAgY2xlYXJSZWR1bmRhbnQoKTtcbiAgICAgICAgU2V0SWNvbih7IHRhYklkIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGNhc2UgJ2VuYWJsZSc6XG4gICAgICAgIHZvaWQgcy5zZXRFbmFibGUoIXMuZW5hYmxlKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdyZWJvb3QnOlxuICAgICAgICBjaHJvbWUucnVudGltZS5yZWxvYWQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdkZWVwU2VhcmNoJzoge1xuICAgICAgICBjb25zdCBlbnRyeSA9IHMuc2NyaXB0TGlzdC5nZXQoJ3NlYXJjaC5qcycpO1xuICAgICAgICBpZiAoZW50cnk/LnRhYklkLmhhcyh0YWJJZCkpIHtcbiAgICAgICAgICBzLnRvZ2dsZVNjcmlwdFRhYignc2VhcmNoLmpzJywgdGFiSWQpO1xuICAgICAgICAgIHMuc2V0RGVlcFNlYXJjaENsb3NlKHRhYklkKTtcbiAgICAgICAgICBjaHJvbWUudGFicy5yZWxvYWQodGFiSWQsIHsgYnlwYXNzQ2FjaGU6IHRydWUgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcy50b2dnbGVTY3JpcHRUYWIoJ3NlYXJjaC5qcycsIHRhYklkKTtcbiAgICAgICAgICBjaHJvbWUudGFicy5yZWxvYWQodGFiSWQsIHsgYnlwYXNzQ2FjaGU6IHRydWUgfSk7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICBjYXNlICdwcmV2aWV3JzpcbiAgICAgICAgdm9pZCBjaHJvbWUudGFicy5jcmVhdGUoeyB1cmw6IGBwcmV2aWV3Lmh0bWw/dGFiSWQ9JHt0YWJJZH1gIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2ltYWdlLXNhdmUnOlxuICAgICAgICBpZiAoZGF0YT8uc3JjVXJsKSB7XG4gICAgICAgICAgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZChcbiAgICAgICAgICAgIHsgdXJsOiBkYXRhLnNyY1VybCwgc2F2ZUFzOiBzLm9wdGlvbnMuc2F2ZUFzIH0sXG4gICAgICAgICAgICAoKSA9PiB7XG4gICAgICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGRvd25EYXRhSW1hZ2VTYXZlID0gZGF0YTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgKTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBjaHJvbWUuY29tbWFuZHM/Lm9uQ29tbWFuZC5hZGRMaXN0ZW5lcigoY29tbWFuZCkgPT4gcnVuQ29tbWFuZHMoY29tbWFuZCkpO1xuICBjaHJvbWUuY29udGV4dE1lbnVzPy5vbkNsaWNrZWQuYWRkTGlzdGVuZXIoKGluZm8sIF90YWIpID0+XG4gICAgcnVuQ29tbWFuZHMoU3RyaW5nKGluZm8ubWVudUl0ZW1JZCksIGluZm8pLFxuICApO1xuXG4gIC8vID09PT09IOWbvueJh+S4i+i9veWksei0peWFnOW6leeUqOeahOS4tOaXtuWPmOmHjyA9PT09PVxuICBsZXQgZG93bkRhdGFJbWFnZVNhdmU6IHsgc3JjVXJsPzogc3RyaW5nOyBwYWdlVXJsPzogc3RyaW5nIH0gfCB1bmRlZmluZWQ7XG5cbiAgLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAvLyBmaW5kTWVkaWEg4oCU4oCUIOWujOaVtOi/mOWOn+WOnyBiYWNrZ3JvdW5kLmpzIOesrCA5NS0zMjIg6KGM55qE5qC45b+D5ZeF5o6i6YC76L6RXG4gIC8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgYXN5bmMgZnVuY3Rpb24gZmluZE1lZGlhKFxuICAgIGRhdGE6IGNocm9tZS53ZWJSZXF1ZXN0LldlYlJlcXVlc3REZXRhaWxzICYge1xuICAgICAgYWxsUmVxdWVzdEhlYWRlcnM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU/OiBzdHJpbmcgfT4gfCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+O1xuICAgICAgaGVhZGVyPzogeyBzaXplPzogbnVtYmVyOyB0eXBlPzogc3RyaW5nOyBhdHRhY2htZW50Pzogc3RyaW5nIH07XG4gICAgICBleHRyYUV4dD86IHN0cmluZztcbiAgICAgIG1pbWU/OiBzdHJpbmc7XG4gICAgICBnZXRUaW1lPzogbnVtYmVyO1xuICAgICAgY29va2llPzogc3RyaW5nO1xuICAgICAgcmVxdWVzdEhlYWRlcnM/OiBBcnJheTx7IG5hbWU6IHN0cmluZzsgdmFsdWU/OiBzdHJpbmcgfT4gfCBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgZmFsc2U7XG4gICAgfSxcbiAgICBpc1JlZ2V4ID0gZmFsc2UsXG4gICAgZmlsdGVyID0gZmFsc2UsXG4gICAgdGltZXIgPSBmYWxzZSxcbiAgKTogUHJvbWlzZTx2b2lkPiB7XG4gICAgY29uc3QgcyA9IHVzZVNldHRpbmdzU3RvcmUuZ2V0U3RhdGUoKTtcbiAgICBjb25zdCBtID0gdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpO1xuICAgIGNvbnN0IHIgPSB1c2VSdW50aW1lU3RvcmUuZ2V0U3RhdGUoKTtcblxuICAgIC8vIFNXIOWUpOmGkuWQjuetieW+heWIneWni+WMluWujOaIkFxuICAgIGlmICghcy5pbml0U3luY0NvbXBsZXRlIHx8ICFzLmluaXRMb2NhbENvbXBsZXRlIHx8IHMudGFiSWQgPT09IC0xIHx8ICFtLmluaXRpYWxpemVkKSB7XG4gICAgICBpZiAodGltZXIpIHJldHVybjtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdm9pZCBmaW5kTWVkaWEoZGF0YSwgaXNSZWdleCwgZmlsdGVyLCB0cnVlKSwgNTAwKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyDpgb/lhY3mipPlj5bliJfooagoZGFtblVybFNldClcbiAgICBpZiAocy5vcHRpb25zLmRhbW4gJiYgZGF0YS50YWJJZCAhPT0gdW5kZWZpbmVkICYmIHMuZGFtblVybFNldC5oYXMoZGF0YS50YWJJZCkpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyDlhajlsYDnpoHnlKggLyDlsY/olL0gLyBPUFRJT05TXG4gICAgY29uc3QgYmxvY2tVcmxGbGFnID0gZGF0YS50YWJJZCAmJiBkYXRhLnRhYklkID4gMCAmJiBzLmJsb2NrVXJsU2V0LmhhcyhkYXRhLnRhYklkKTtcbiAgICBpZiAoIXMuZW5hYmxlIHx8IChzLmJsb2NrVXJsV2hpdGUgPyAhYmxvY2tVcmxGbGFnIDogYmxvY2tVcmxGbGFnKSB8fCAoZGF0YSBhcyBhbnkpLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgKGRhdGEgYXMgYW55KS5nZXRUaW1lID0gRGF0ZS5ub3coKTtcblxuICAgIC8vIOato+WImem7keWQjeWNlSjpnZ4gaXNSZWdleCDosIPnlKjml7bmo4Dmn6UpXG4gICAgaWYgKCFpc1JlZ2V4ICYmIGRhdGEucmVxdWVzdElkICYmIHIuaGFzQmxhY2tMaXN0KGRhdGEucmVxdWVzdElkKSkge1xuICAgICAgci5kZWxldGVCbGFja0xpc3QoZGF0YS5yZXF1ZXN0SWQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIOWxj+iUveeJueauiumhtemdolxuICAgIGNvbnN0IGluaXRpYXRvciA9IChkYXRhIGFzIGFueSkuaW5pdGlhdG9yIGFzIHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICBpZiAoaW5pdGlhdG9yICE9PSAnbnVsbCcgJiYgaW5pdGlhdG9yICE9PSB1bmRlZmluZWQgJiYgaXNTcGVjaWFsUGFnZShpbml0aWF0b3IpKSByZXR1cm47XG4gICAgaWYgKHMuaXNGaXJlZm94KSB7XG4gICAgICBjb25zdCBvcmlnaW5VcmwgPSAoZGF0YSBhcyBhbnkpLm9yaWdpblVybCBhcyBzdHJpbmcgfCB1bmRlZmluZWQ7XG4gICAgICBpZiAob3JpZ2luVXJsICYmIGlzU3BlY2lhbFBhZ2Uob3JpZ2luVXJsKSkgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoIWRhdGEudXJsIHx8IGlzU3BlY2lhbFBhZ2UoZGF0YS51cmwpKSByZXR1cm47XG5cbiAgICBjb25zdCB1cmxQYXJzaW5nID0gbmV3IFVSTChkYXRhLnVybCk7XG4gICAgbGV0IFtuYW1lLCBleHRdID0gZmlsZU5hbWVQYXJzZSh1cmxQYXJzaW5nLnBhdGhuYW1lKTtcblxuICAgIC8vID09PT09IOato+WImeWMuemFjeWIhuaUryA9PT09PVxuICAgIGlmIChpc1JlZ2V4ICYmICFmaWx0ZXIpIHtcbiAgICAgIGZvciAoY29uc3QgcnVsZSBvZiBzLlJlZ2V4KSB7XG4gICAgICAgIGlmICghcnVsZS5zdGF0ZSkgY29udGludWU7XG4gICAgICAgIHJ1bGUucmVnZXgubGFzdEluZGV4ID0gMDtcbiAgICAgICAgY29uc3QgcmVzdWx0ID0gcnVsZS5yZWdleC5leGVjKGRhdGEudXJsKTtcbiAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbCkgY29udGludWU7XG4gICAgICAgIGlmIChydWxlLmJsYWNrTGlzdCkge1xuICAgICAgICAgIHVzZVJ1bnRpbWVTdG9yZS5nZXRTdGF0ZSgpLmFkZEJsYWNrTGlzdChkYXRhLnJlcXVlc3RJZCA/PyBTdHJpbmcoRGF0ZS5ub3coKSkpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICAoZGF0YSBhcyBhbnkpLmV4dHJhRXh0ID0gcnVsZS5leHQgPyBydWxlLmV4dCA6IHVuZGVmaW5lZDtcbiAgICAgICAgaWYgKHJlc3VsdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICB2b2lkIGZpbmRNZWRpYShkYXRhLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgY29uc3Qgc2hpZnRlZCA9IHJlc3VsdC5zbGljZSgxKS5tYXAoKHN0cikgPT4gZGVjb2RlVVJJQ29tcG9uZW50KHN0cikpO1xuICAgICAgICBjb25zdCBmaXJzdCA9IHNoaWZ0ZWRbMF07XG4gICAgICAgIGlmIChmaXJzdCAmJiAhZmlyc3Quc3RhcnRzV2l0aCgnaHR0cHM6Ly8nKSAmJiAhZmlyc3Quc3RhcnRzV2l0aCgnaHR0cDovLycpKSB7XG4gICAgICAgICAgc2hpZnRlZFswXSA9IHVybFBhcnNpbmcucHJvdG9jb2wgKyAnLy8nICsgZGF0YS51cmw7XG4gICAgICAgIH1cbiAgICAgICAgZGF0YS51cmwgPSBzaGlmdGVkLmpvaW4oJycpO1xuICAgICAgICB2b2lkIGZpbmRNZWRpYShkYXRhLCB0cnVlLCB0cnVlKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vID09PT09IOmdnuato+WImeWMuemFjeWIhuaUrzrln7rkuo4gRXh0L1R5cGUv6ZmE5Lu2L21lZGlhIOexu+WeiyA9PT09PVxuICAgIGlmICghaXNSZWdleCkge1xuICAgICAgKGRhdGEgYXMgYW55KS5oZWFkZXIgPSBnZXRSZXNwb25zZUhlYWRlcnNWYWx1ZShkYXRhIGFzIGFueSk7XG4gICAgICBjb25zdCBoZWFkZXIgPSAoZGF0YSBhcyBhbnkpLmhlYWRlciBhcyB7IHNpemU/OiBudW1iZXI7IHR5cGU/OiBzdHJpbmc7IGF0dGFjaG1lbnQ/OiBzdHJpbmcgfTtcblxuICAgICAgLy8g5qOA5p+l5omp5bGV5ZCNXG4gICAgICBpZiAoIWZpbHRlciAmJiBleHQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBmaWx0ZXIgPSBDaGVja0V4dGVuc2lvbihleHQsIGhlYWRlci5zaXplKSBhcyBib29sZWFuO1xuICAgICAgICBpZiAoZmlsdGVyID09PSAoJ2JyZWFrJyBhcyBhbnkpKSByZXR1cm47XG4gICAgICB9XG4gICAgICAvLyDmo4Dmn6XnsbvlnotcbiAgICAgIGlmICghZmlsdGVyICYmIGhlYWRlci50eXBlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZmlsdGVyID0gQ2hlY2tUeXBlKGhlYWRlci50eXBlLCBoZWFkZXIuc2l6ZSkgYXMgYm9vbGVhbjtcbiAgICAgICAgaWYgKGZpbHRlciA9PT0gKCdicmVhaycgYXMgYW55KSkgcmV0dXJuO1xuICAgICAgfVxuICAgICAgLy8g5qOA5p+l6ZmE5Lu2XG4gICAgICBpZiAoIWZpbHRlciAmJiBoZWFkZXIuYXR0YWNobWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGNvbnN0IHBhcnNlZCA9IHBhcnNlQXR0YWNobWVudEZpbGVuYW1lKGhlYWRlci5hdHRhY2htZW50KTtcbiAgICAgICAgaWYgKHBhcnNlZCkge1xuICAgICAgICAgIFtuYW1lLCBleHRdID0gcGFyc2VkO1xuICAgICAgICAgIGZpbHRlciA9IENoZWNrRXh0ZW5zaW9uKGV4dCA/PyAnJywgMCkgYXMgYm9vbGVhbjtcbiAgICAgICAgICBpZiAoZmlsdGVyID09PSAoJ2JyZWFrJyBhcyBhbnkpKSByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIC8vIG1lZGlhIOexu+Wei+i1hOa6kOebtOaOpemAmui/h1xuICAgICAgaWYgKChkYXRhIGFzIGFueSkudHlwZSA9PT0gJ21lZGlhJykge1xuICAgICAgICBmaWx0ZXIgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghZmlsdGVyKSByZXR1cm47XG5cbiAgICAvLyB0YWJJZCA9PSAtMSDml7bkvb/nlKjlvZPliY3mv4DmtLsgdGFiXG4gICAgaWYgKGRhdGEudGFiSWQgPT09IC0xIHx8IGRhdGEudGFiSWQgPT09IHVuZGVmaW5lZCkge1xuICAgICAgZGF0YS50YWJJZCA9IHMudGFiSWQ7XG4gICAgfVxuICAgIGNvbnN0IGZpbmFsVGFiSWQgPSBkYXRhLnRhYklkO1xuXG4gICAgLy8g57yT5a2Y6LaF6ZmQ5riF56m6XG4gICAgY29uc3QgY3VycmVudExpc3QgPSB1c2VNZWRpYVN0b3JlLmdldFN0YXRlKCkuZ2V0QnlUYWIoZmluYWxUYWJJZCk7XG4gICAgaWYgKGN1cnJlbnRMaXN0Lmxlbmd0aCA+IHMub3B0aW9ucy5tYXhMZW5ndGgpIHtcbiAgICAgIHVzZU1lZGlhU3RvcmUuZ2V0U3RhdGUoKS5jbGVhclRhYihmaW5hbFRhYklkKTtcbiAgICAgIHZvaWQgdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLnBlcnNpc3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBVUkwg5p+l6YeNKOWfuuS6jiB0YWJJZCDliIbmobYs6LaFIDUwMCDmuIXnqbopXG4gICAgaWYgKHMub3B0aW9ucy5jaGVja0R1cGxpY2F0ZXMgJiYgY3VycmVudExpc3QubGVuZ3RoIDw9IDUwMCkge1xuICAgICAgaWYgKHVzZVJ1bnRpbWVTdG9yZS5nZXRTdGF0ZSgpLmhhc1VybChmaW5hbFRhYklkLCBkYXRhLnVybCkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdXNlUnVudGltZVN0b3JlLmdldFN0YXRlKCkuYWRkVXJsKGZpbmFsVGFiSWQsIGRhdGEudXJsKTtcbiAgICB9XG5cbiAgICAvLyA9PT09PSDojrflj5Ygd2ViSW5mbyArIOWGmeWFpSBzdG9yZSArIOWPkemAgeWIsCBwb3B1cC/mnKzlnLAgPT09PT1cbiAgICBjaHJvbWUudGFicy5nZXQoZmluYWxUYWJJZCwgKHdlYkluZm8pID0+IHtcbiAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHJldHVybjtcblxuICAgICAgLy8gZ2V0UmVxdWVzdEhlYWRlcnMg6L+U5ZueIFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBmYWxzZSxmYWxzZSDnu5/kuIDlvZLkuIDljJbkuLogdW5kZWZpbmVkXG4gICAgICBjb25zdCByZXF1ZXN0SGVhZGVyczogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IHVuZGVmaW5lZCA9IGdldFJlcXVlc3RIZWFkZXJzKGRhdGEpIHx8IHVuZGVmaW5lZDtcbiAgICAgIGxldCBjb29raWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbiAgICAgIGlmIChyZXF1ZXN0SGVhZGVycz8uY29va2llKSB7XG4gICAgICAgIGNvb2tpZSA9IHJlcXVlc3RIZWFkZXJzLmNvb2tpZTtcbiAgICAgICAgZGVsZXRlIHJlcXVlc3RIZWFkZXJzLmNvb2tpZTtcbiAgICAgIH1cbiAgICAgIChkYXRhIGFzIGFueSkucmVxdWVzdEhlYWRlcnMgPSByZXF1ZXN0SGVhZGVycztcblxuICAgICAgY29uc3QgaW5mbzogTWVkaWFJdGVtID0ge1xuICAgICAgICBuYW1lLFxuICAgICAgICB1cmw6IGRhdGEudXJsLFxuICAgICAgICBzaXplOiAoZGF0YSBhcyBhbnkpLmhlYWRlcj8uc2l6ZSxcbiAgICAgICAgZXh0LFxuICAgICAgICB0eXBlOiAoZGF0YSBhcyBhbnkpLm1pbWUgPz8gKGRhdGEgYXMgYW55KS5oZWFkZXI/LnR5cGUsXG4gICAgICAgIHRhYklkOiBmaW5hbFRhYklkLFxuICAgICAgICBpc1JlZ2V4LFxuICAgICAgICByZXF1ZXN0SWQ6IGRhdGEucmVxdWVzdElkID8/IERhdGUubm93KCkudG9TdHJpbmcoKSxcbiAgICAgICAgaW5pdGlhdG9yOiAoZGF0YSBhcyBhbnkpLmluaXRpYXRvcixcbiAgICAgICAgcmVxdWVzdEhlYWRlcnMsXG4gICAgICAgIGNvb2tpZSxcbiAgICAgICAgZ2V0VGltZTogKGRhdGEgYXMgYW55KS5nZXRUaW1lLFxuICAgICAgfTtcblxuICAgICAgLy8g5LiN5a2Y5Zyo5omp5bGV5pe25L2/55SoIHR5cGVcbiAgICAgIGlmIChpbmZvLmV4dCA9PT0gdW5kZWZpbmVkICYmIGluZm8udHlwZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgIGluZm8uZXh0ID0gaW5mby50eXBlLnNwbGl0KCcvJylbMV07XG4gICAgICB9XG4gICAgICAvLyDmraPliJnljLnphY3nmoTlpIfms6jmianlsZVcbiAgICAgIGlmICgoZGF0YSBhcyBhbnkpLmV4dHJhRXh0KSB7XG4gICAgICAgIGluZm8uZXh0ID0gKGRhdGEgYXMgYW55KS5leHRyYUV4dDtcbiAgICAgIH1cbiAgICAgIC8vIGluaXRpYXRvciAvIHJlZmVyZXIg5LqS6KGlXG4gICAgICBpZiAoaW5mby5pbml0aWF0b3IgPT09IHVuZGVmaW5lZCB8fCBpbmZvLmluaXRpYXRvciA9PT0gJ251bGwnKSB7XG4gICAgICAgIGluZm8uaW5pdGlhdG9yID0gcmVxdWVzdEhlYWRlcnM/LnJlZmVyZXIgPz8gd2ViSW5mbz8udXJsO1xuICAgICAgfVxuICAgICAgLy8g6KOF6L296aG16Z2i5L+h5oGvXG4gICAgICBpbmZvLnRpdGxlID0gd2ViSW5mbz8udGl0bGUgPz8gJ05VTEwnO1xuICAgICAgaW5mby5mYXZJY29uVXJsID0gd2ViSW5mbz8uZmF2SWNvblVybDtcbiAgICAgIGluZm8ud2ViVXJsID0gd2ViSW5mbz8udXJsO1xuXG4gICAgICAvLyDkuozmrKHmo4Dmn6Xpu5HlkI3ljZVcbiAgICAgIGlmICghaXNSZWdleCAmJiBkYXRhLnJlcXVlc3RJZCAmJiB1c2VSdW50aW1lU3RvcmUuZ2V0U3RhdGUoKS5oYXNCbGFja0xpc3QoZGF0YS5yZXF1ZXN0SWQpKSB7XG4gICAgICAgIHVzZVJ1bnRpbWVTdG9yZS5nZXRTdGF0ZSgpLmRlbGV0ZUJsYWNrTGlzdChkYXRhLnJlcXVlc3RJZCk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgLy8g5Y+R6YCB5YiwIHBvcHVwIOW5tuWkhOeQhuiHquWKqOS4i+i9vVxuICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyBNZXNzYWdlOiAncG9wdXBBZGREYXRhJywgZGF0YTogaW5mbyB9LCAoKSA9PiB7XG4gICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IpIHJldHVybjtcbiAgICAgICAgY29uc3Qgc3QgPSB1c2VTZXR0aW5nc1N0b3JlLmdldFN0YXRlKCk7XG4gICAgICAgIGNvbnN0IGRvd25sb2Fkc1N0YXRlID0gKGNocm9tZS5kb3dubG9hZHMgYXMgYW55KT8uU3RhdGU7XG4gICAgICAgIGlmIChcbiAgICAgICAgICBzdC5mZWF0QXV0b0Rvd25UYWJJZC5zaXplID4gMCAmJlxuICAgICAgICAgIHN0LmZlYXRBdXRvRG93blRhYklkLmhhcyhpbmZvLnRhYklkKSAmJlxuICAgICAgICAgIGRvd25sb2Fkc1N0YXRlXG4gICAgICAgICkge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCB0aXRsZSA9ICFpbmZvLnRpdGxlIHx8IGluZm8udGl0bGUgPT09ICdOVUxMJ1xuICAgICAgICAgICAgICA/ICdDYXRDYXRjaC8nXG4gICAgICAgICAgICAgIDogc3RyaW5nTW9kaWZ5KGluZm8udGl0bGUpICsgJy8nO1xuICAgICAgICAgICAgbGV0IGZpbGVOYW1lOiBzdHJpbmc7XG4gICAgICAgICAgICBpZiAoc3Qub3B0aW9ucy5UaXRsZU5hbWUpIHtcbiAgICAgICAgICAgICAgZmlsZU5hbWUgPSBmaWx0ZXJGaWxlTmFtZShcbiAgICAgICAgICAgICAgICB0ZW1wbGF0ZXMoc3Qub3B0aW9ucy5kb3duRmlsZU5hbWUsIGluZm8gYXMgdW5rbm93biBhcyBUZW1wbGF0ZUNvbnRleHQpLFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgY29uc3QgYmFzZU5hbWUgPSAhaW5mby5uYW1lXG4gICAgICAgICAgICAgICAgPyBzdHJpbmdNb2RpZnkoaW5mby50aXRsZSA/PyAnTlVMTCcpICsgJy4nICsgKGluZm8uZXh0ID8/ICcnKVxuICAgICAgICAgICAgICAgIDogZGVjb2RlVVJJQ29tcG9uZW50KHN0cmluZ01vZGlmeShpbmZvLm5hbWUpKTtcbiAgICAgICAgICAgICAgZmlsZU5hbWUgPSB0aXRsZSArIGJhc2VOYW1lO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdm9pZCBjaHJvbWUuZG93bmxvYWRzLmRvd25sb2FkKHsgdXJsOiBpbmZvLnVybCwgZmlsZW5hbWU6IGZpbGVOYW1lIH0pO1xuICAgICAgICAgIH0gY2F0Y2gge1xuICAgICAgICAgICAgLyog5ZCe5o6J6Ieq5Yqo5LiL6L296ZSZ6K+vICovXG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgLy8g5Y+R6YCB5Yiw5pys5ZywXG4gICAgICBpZiAocy5vcHRpb25zLnNlbmQybG9jYWwpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICB2b2lkIHNlbmQybG9jYWwoJ2NhdGNoJywgeyAuLi5pbmZvLCByZXF1ZXN0SGVhZGVyczogKGRhdGEgYXMgYW55KS5hbGxSZXF1ZXN0SGVhZGVycyB9LCBpbmZvLnRhYklkKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLy8g5YaZ5YWlIHN0b3JlXG4gICAgICB1c2VNZWRpYVN0b3JlLmdldFN0YXRlKCkucHVzaChpbmZvKTtcblxuICAgICAgLy8g6Ziy5oqW5oyB5LmF5YyWXG4gICAgICB2b2lkIHNhdmUoZmluYWxUYWJJZCk7XG4gICAgfSk7XG4gIH1cblxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIC8vIHNhdmUodGFiSWQpIOKAlOKAlCDmjIHkuYXljJYgKyDorr7nva7lm77moIco6L+Y5Y6fIGJhY2tncm91bmQuanMg56ysIDMyNC0zMzcg6KGMKVxuICAvLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09XG4gIGFzeW5jIGZ1bmN0aW9uIHNhdmUodGFiSWQ6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuICAgIGNvbnN0IHIgPSB1c2VSdW50aW1lU3RvcmUuZ2V0U3RhdGUoKTtcbiAgICBpZiAoci5kZWJvdW5jZVRpbWVyKSBjbGVhclRpbWVvdXQoci5kZWJvdW5jZVRpbWVyKTtcblxuICAgIGNvbnN0IGxpc3QgPSB1c2VNZWRpYVN0b3JlLmdldFN0YXRlKCkuZ2V0QnlUYWIodGFiSWQpO1xuICAgIC8vIOWNlSB0YWIg5pWw5o2u6LaF6L+HIDk5IOadoeS4jeWGmSBzdG9yYWdlKOmBv+WFjSBxdW90YSlcbiAgICBpZiAobGlzdC5sZW5ndGggPD0gOTkpIHtcbiAgICAgIHZvaWQgdXNlTWVkaWFTdG9yZS5nZXRTdGF0ZSgpLnBlcnNpc3QoKTtcbiAgICB9XG4gICAgU2V0SWNvbih7IG51bWJlcjogbGlzdC5sZW5ndGgsIHRhYklkIH0pO1xuICAgIHVzZVJ1bnRpbWVTdG9yZS5nZXRTdGF0ZSgpLnNldERlYm91bmNlKHVuZGVmaW5lZCwgMCwgRGF0ZS5ub3coKSk7XG4gIH1cbn0pO1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBicm93c2VyJDEgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuLy8jcmVnaW9uIHNyYy9icm93c2VyLnRzXG4vKipcbiogQ29udGFpbnMgdGhlIGBicm93c2VyYCBleHBvcnQgd2hpY2ggeW91IHNob3VsZCB1c2UgdG8gYWNjZXNzIHRoZSBleHRlbnNpb25cbiogQVBJcyBpbiB5b3VyIHByb2plY3Q6XG4qXG4qIGBgYHRzXG4qIGltcG9ydCB7IGJyb3dzZXIgfSBmcm9tICd3eHQvYnJvd3Nlcic7XG4qXG4qIGJyb3dzZXIucnVudGltZS5vbkluc3RhbGxlZC5hZGRMaXN0ZW5lcigoKSA9PiB7XG4qICAgLy8gLi4uXG4qIH0pO1xuKiBgYGBcbipcbiogQG1vZHVsZSB3eHQvYnJvd3NlclxuKi9cbmNvbnN0IGJyb3dzZXIgPSBicm93c2VyJDE7XG4vLyNlbmRyZWdpb25cbmV4cG9ydCB7IGJyb3dzZXIgfTtcbiIsIi8vI3JlZ2lvbiBzcmMvaW5kZXgudHNcbi8qKlxuKiBDbGFzcyBmb3IgcGFyc2luZyBhbmQgcGVyZm9ybWluZyBvcGVyYXRpb25zIG9uIG1hdGNoIHBhdHRlcm5zLlxuKlxuKiBAZXhhbXBsZVxuKiAgIGNvbnN0IHBhdHRlcm4gPSBuZXcgTWF0Y2hQYXR0ZXJuKCcqOi8vZ29vZ2xlLmNvbS8qJyk7XG4qXG4qICAgcGF0dGVybi5pbmNsdWRlcygnaHR0cHM6Ly9nb29nbGUuY29tJyk7IC8vIHRydWVcbiogICBwYXR0ZXJuLmluY2x1ZGVzKCdodHRwOi8veW91dHViZS5jb20vd2F0Y2g/dj0xMjMnKTsgLy8gZmFsc2VcbiovXG52YXIgTWF0Y2hQYXR0ZXJuID0gY2xhc3MgTWF0Y2hQYXR0ZXJuIHtcblx0c3RhdGljIHtcblx0XHR0aGlzLlBST1RPQ09MUyA9IFtcblx0XHRcdFwiaHR0cFwiLFxuXHRcdFx0XCJodHRwc1wiLFxuXHRcdFx0XCJmaWxlXCIsXG5cdFx0XHRcImZ0cFwiLFxuXHRcdFx0XCJ1cm5cIixcblx0XHRcdFwid3NcIixcblx0XHRcdFwid3NzXCJcblx0XHRdO1xuXHR9XG5cdC8qKlxuXHQqIFBhcnNlIGEgbWF0Y2ggcGF0dGVybiBzdHJpbmcuIElmIGl0IGlzIGludmFsaWQsIHRoZSBjb25zdHJ1Y3RvciB3aWxsIHRocm93IGFuXG5cdCogYEludmFsaWRNYXRjaFBhdHRlcm5gIGVycm9yLlxuXHQqXG5cdCogQHBhcmFtIG1hdGNoUGF0dGVybiBUaGUgbWF0Y2ggcGF0dGVybiB0byBwYXJzZS5cblx0Ki9cblx0Y29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG5cdFx0aWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcblx0XHRcdHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcblx0XHRcdHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLk1hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuXHRcdFx0dGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG5cdFx0XHR0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG5cdFx0XHRpZiAoZ3JvdXBzID09IG51bGwpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuXHRcdFx0Y29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuXHRcdFx0dmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcblx0XHRcdHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG5cdFx0XHR0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG5cdFx0XHR0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcblx0XHRcdHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuXHRcdH1cblx0fVxuXHQvKiogQ2hlY2sgaWYgYSBVUkwgaXMgaW5jbHVkZWQgaW4gYSBwYXR0ZXJuLiAqL1xuXHRpbmNsdWRlcyh1cmwpIHtcblx0XHRjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG5cdFx0aWYgKHRoaXMuaXNBbGxVcmxzKSByZXR1cm4gIXRoaXMuaXNVbmtub3duUHJvdG9jb2wodSk7XG5cdFx0cmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcblx0XHRcdGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcImZ0cFwiKSByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuXHRcdFx0aWYgKHByb3RvY29sID09PSBcInVyblwiKSByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuXHRcdH0pO1xuXHR9XG5cdGlzSHR0cE1hdGNoKHVybCkge1xuXHRcdHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuXHR9XG5cdGlzSHR0cHNNYXRjaCh1cmwpIHtcblx0XHRyZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG5cdH1cblx0aXNIb3N0UGF0aE1hdGNoKHVybCkge1xuXHRcdGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpIHJldHVybiBmYWxzZTtcblx0XHRjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW3RoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXTtcblx0XHRjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuXHRcdHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcblx0fVxuXHRpc1Vua25vd25Qcm90b2NvbCh1cmwpIHtcblx0XHRyZXR1cm4gIXRoaXMucHJvdG9jb2xNYXRjaGVzLmluY2x1ZGVzKHVybC5wcm90b2NvbC5zbGljZSgwLCAtMSkpO1xuXHR9XG5cdGlzUGF0aE1hdGNoKHVybCkge1xuXHRcdGlmICghdGhpcy5wYXRobmFtZU1hdGNoKSByZXR1cm4gZmFsc2U7XG5cdFx0cmV0dXJuIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCkudGVzdCh1cmwucGF0aG5hbWUpO1xuXHR9XG5cdGlzRmlsZU1hdGNoKHVybCkge1xuXHRcdHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiZmlsZTpcIiAmJiB0aGlzLmlzUGF0aE1hdGNoKHVybCk7XG5cdH1cblx0aXNGdHBNYXRjaChfdXJsKSB7XG5cdFx0dGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG5cdH1cblx0aXNVcm5NYXRjaChfdXJsKSB7XG5cdFx0dGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG5cdH1cblx0Y29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcblx0XHRjb25zdCBzdGFyc1JlcGxhY2VkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKS5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG5cdFx0cmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG5cdH1cblx0ZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG5cdH1cbn07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuXHRjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuXHRcdHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG5cdH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcblx0aWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuXHRpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKSB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcblx0aWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgKTtcbn1cbi8vI2VuZHJlZ2lvblxuZXhwb3J0IHsgSW52YWxpZE1hdGNoUGF0dGVybiwgTWF0Y2hQYXR0ZXJuIH07XG4iXSwibmFtZXMiOlsicmVzdWx0IiwiY3JlYXRlIiwicmVhY3RNb2R1bGUiLCJyZXF1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
