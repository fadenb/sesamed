(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*!
 * assertion-error
 * Copyright(c) 2013 Jake Luer <jake@qualiancy.com>
 * MIT Licensed
 */

/*!
 * Return a function that will copy properties from
 * one object to another excluding any originally
 * listed. Returned function will create a new `{}`.
 *
 * @param {String} excluded properties ...
 * @return {Function}
 */

function exclude () {
  var excludes = [].slice.call(arguments);

  function excludeProps (res, obj) {
    Object.keys(obj).forEach(function (key) {
      if (!~excludes.indexOf(key)) res[key] = obj[key];
    });
  }

  return function extendExclude () {
    var args = [].slice.call(arguments)
      , i = 0
      , res = {};

    for (; i < args.length; i++) {
      excludeProps(res, args[i]);
    }

    return res;
  };
};

/*!
 * Primary Exports
 */

module.exports = AssertionError;

/**
 * ### AssertionError
 *
 * An extension of the JavaScript `Error` constructor for
 * assertion and validation scenarios.
 *
 * @param {String} message
 * @param {Object} properties to include (optional)
 * @param {callee} start stack function (optional)
 */

function AssertionError (message, _props, ssf) {
  var extend = exclude('name', 'message', 'stack', 'constructor', 'toJSON')
    , props = extend(_props || {});

  // default values
  this.message = message || 'Unspecified AssertionError';
  this.showDiff = false;

  // copy from properties
  for (var key in props) {
    this[key] = props[key];
  }

  // capture stack trace
  ssf = ssf || AssertionError;
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, ssf);
  } else {
    try {
      throw new Error();
    } catch(e) {
      this.stack = e.stack;
    }
  }
}

/*!
 * Inherit from Error.prototype
 */

AssertionError.prototype = Object.create(Error.prototype);

/*!
 * Statically set name
 */

AssertionError.prototype.name = 'AssertionError';

/*!
 * Ensure correct constructor
 */

AssertionError.prototype.constructor = AssertionError;

/**
 * Allow errors to be converted to JSON for static transfer.
 *
 * @param {Boolean} include stack (default: `true`)
 * @return {Object} object that can be `JSON.stringify`
 */

AssertionError.prototype.toJSON = function (stack) {
  var extend = exclude('constructor', 'toJSON', 'stack')
    , props = extend({ name: this.name }, this);

  // include stack if exists and not turned off
  if (false !== stack && this.stack) {
    props.stack = this.stack;
  }

  return props;
};

},{}],2:[function(require,module,exports){
"use strict";
/* eslint-disable no-invalid-this */
let checkError = require("check-error");

module.exports = (chai, utils) => {
    const Assertion = chai.Assertion;
    const assert = chai.assert;
    const proxify = utils.proxify;

    // If we are using a version of Chai that has checkError on it,
    // we want to use that version to be consistent. Otherwise, we use
    // what was passed to the factory.
    if (utils.checkError) {
        checkError = utils.checkError;
    }

    function isLegacyJQueryPromise(thenable) {
        // jQuery promises are Promises/A+-compatible since 3.0.0. jQuery 3.0.0 is also the first version
        // to define the catch method.
        return typeof thenable.catch !== "function" &&
               typeof thenable.always === "function" &&
               typeof thenable.done === "function" &&
               typeof thenable.fail === "function" &&
               typeof thenable.pipe === "function" &&
               typeof thenable.progress === "function" &&
               typeof thenable.state === "function";
    }

    function assertIsAboutPromise(assertion) {
        if (typeof assertion._obj.then !== "function") {
            throw new TypeError(utils.inspect(assertion._obj) + " is not a thenable.");
        }
        if (isLegacyJQueryPromise(assertion._obj)) {
            throw new TypeError("Chai as Promised is incompatible with thenables of jQuery<3.0.0, sorry! Please " +
                                "upgrade jQuery or use another Promises/A+ compatible library (see " +
                                "http://promisesaplus.com/).");
        }
    }

    function proxifyIfSupported(assertion) {
        return proxify === undefined ? assertion : proxify(assertion);
    }

    function method(name, asserter) {
        utils.addMethod(Assertion.prototype, name, function () {
            assertIsAboutPromise(this);
            return asserter.apply(this, arguments);
        });
    }

    function property(name, asserter) {
        utils.addProperty(Assertion.prototype, name, function () {
            assertIsAboutPromise(this);
            return proxifyIfSupported(asserter.apply(this, arguments));
        });
    }

    function doNotify(promise, done) {
        promise.then(() => done(), done);
    }

    // These are for clarity and to bypass Chai refusing to allow `undefined` as actual when used with `assert`.
    function assertIfNegated(assertion, message, extra) {
        assertion.assert(true, null, message, extra.expected, extra.actual);
    }

    function assertIfNotNegated(assertion, message, extra) {
        assertion.assert(false, message, null, extra.expected, extra.actual);
    }

    function getBasePromise(assertion) {
        // We need to chain subsequent asserters on top of ones in the chain already (consider
        // `eventually.have.property("foo").that.equals("bar")`), only running them after the existing ones pass.
        // So the first base-promise is `assertion._obj`, but after that we use the assertions themselves, i.e.
        // previously derived promises, to chain off of.
        return typeof assertion.then === "function" ? assertion : assertion._obj;
    }

    function getReasonName(reason) {
        return reason instanceof Error ? reason.toString() : checkError.getConstructorName(reason);
    }

    // Grab these first, before we modify `Assertion.prototype`.

    const propertyNames = Object.getOwnPropertyNames(Assertion.prototype);

    const propertyDescs = {};
    for (const name of propertyNames) {
        propertyDescs[name] = Object.getOwnPropertyDescriptor(Assertion.prototype, name);
    }

    property("fulfilled", function () {
        const derivedPromise = getBasePromise(this).then(
            value => {
                assertIfNegated(this,
                                "expected promise not to be fulfilled but it was fulfilled with #{act}",
                                { actual: value });
                return value;
            },
            reason => {
                assertIfNotNegated(this,
                                   "expected promise to be fulfilled but it was rejected with #{act}",
                                   { actual: getReasonName(reason) });
                return reason;
            }
        );

        module.exports.transferPromiseness(this, derivedPromise);
        return this;
    });

    property("rejected", function () {
        const derivedPromise = getBasePromise(this).then(
            value => {
                assertIfNotNegated(this,
                                   "expected promise to be rejected but it was fulfilled with #{act}",
                                   { actual: value });
                return value;
            },
            reason => {
                assertIfNegated(this,
                                "expected promise not to be rejected but it was rejected with #{act}",
                                { actual: getReasonName(reason) });

                // Return the reason, transforming this into a fulfillment, to allow further assertions, e.g.
                // `promise.should.be.rejected.and.eventually.equal("reason")`.
                return reason;
            }
        );

        module.exports.transferPromiseness(this, derivedPromise);
        return this;
    });

    method("rejectedWith", function (errorLike, errMsgMatcher, message) {
        let errorLikeName = null;
        const negate = utils.flag(this, "negate") || false;

        // rejectedWith with that is called without arguments is
        // the same as a plain ".rejected" use.
        if (errorLike === undefined && errMsgMatcher === undefined &&
            message === undefined) {
            /* eslint-disable no-unused-expressions */
            return this.rejected;
            /* eslint-enable no-unused-expressions */
        }

        if (message !== undefined) {
            utils.flag(this, "message", message);
        }

        if (errorLike instanceof RegExp || typeof errorLike === "string") {
            errMsgMatcher = errorLike;
            errorLike = null;
        } else if (errorLike && errorLike instanceof Error) {
            errorLikeName = errorLike.toString();
        } else if (typeof errorLike === "function") {
            errorLikeName = checkError.getConstructorName(errorLike);
        } else {
            errorLike = null;
        }
        const everyArgIsDefined = Boolean(errorLike && errMsgMatcher);

        let matcherRelation = "including";
        if (errMsgMatcher instanceof RegExp) {
            matcherRelation = "matching";
        }

        const derivedPromise = getBasePromise(this).then(
            value => {
                let assertionMessage = null;
                let expected = null;

                if (errorLike) {
                    assertionMessage = "expected promise to be rejected with #{exp} but it was fulfilled with #{act}";
                    expected = errorLikeName;
                } else if (errMsgMatcher) {
                    assertionMessage = `expected promise to be rejected with an error ${matcherRelation} #{exp} but ` +
                                       `it was fulfilled with #{act}`;
                    expected = errMsgMatcher;
                }

                assertIfNotNegated(this, assertionMessage, { expected, actual: value });
                return value;
            },
            reason => {
                const errorLikeCompatible = errorLike && (errorLike instanceof Error ?
                                                        checkError.compatibleInstance(reason, errorLike) :
                                                        checkError.compatibleConstructor(reason, errorLike));

                const errMsgMatcherCompatible = errMsgMatcher && checkError.compatibleMessage(reason, errMsgMatcher);

                const reasonName = getReasonName(reason);

                if (negate && everyArgIsDefined) {
                    if (errorLikeCompatible && errMsgMatcherCompatible) {
                        this.assert(true,
                                    null,
                                    "expected promise not to be rejected with #{exp} but it was rejected " +
                                    "with #{act}",
                                    errorLikeName,
                                    reasonName);
                    }
                } else {
                    if (errorLike) {
                        this.assert(errorLikeCompatible,
                                    "expected promise to be rejected with #{exp} but it was rejected with #{act}",
                                    "expected promise not to be rejected with #{exp} but it was rejected " +
                                    "with #{act}",
                                    errorLikeName,
                                    reasonName);
                    }

                    if (errMsgMatcher) {
                        this.assert(errMsgMatcherCompatible,
                                    `expected promise to be rejected with an error ${matcherRelation} #{exp} but got ` +
                                    `#{act}`,
                                    `expected promise not to be rejected with an error ${matcherRelation} #{exp}`,
                                    errMsgMatcher,
                                    checkError.getMessage(reason));
                    }
                }

                return reason;
            }
        );

        module.exports.transferPromiseness(this, derivedPromise);
        return this;
    });

    property("eventually", function () {
        utils.flag(this, "eventually", true);
        return this;
    });

    method("notify", function (done) {
        doNotify(getBasePromise(this), done);
        return this;
    });

    method("become", function (value, message) {
        return this.eventually.deep.equal(value, message);
    });

    // ### `eventually`

    // We need to be careful not to trigger any getters, thus `Object.getOwnPropertyDescriptor` usage.
    const methodNames = propertyNames.filter(name => {
        return name !== "assert" && typeof propertyDescs[name].value === "function";
    });

    methodNames.forEach(methodName => {
        Assertion.overwriteMethod(methodName, originalMethod => function () {
            return doAsserterAsyncAndAddThen(originalMethod, this, arguments);
        });
    });

    const getterNames = propertyNames.filter(name => {
        return name !== "_obj" && typeof propertyDescs[name].get === "function";
    });

    getterNames.forEach(getterName => {
        // Chainable methods are things like `an`, which can work both for `.should.be.an.instanceOf` and as
        // `should.be.an("object")`. We need to handle those specially.
        const isChainableMethod = Assertion.prototype.__methods.hasOwnProperty(getterName);

        if (isChainableMethod) {
            Assertion.overwriteChainableMethod(
                getterName,
                originalMethod => function () {
                    return doAsserterAsyncAndAddThen(originalMethod, this, arguments);
                },
                originalGetter => function () {
                    return doAsserterAsyncAndAddThen(originalGetter, this);
                }
            );
        } else {
            Assertion.overwriteProperty(getterName, originalGetter => function () {
                return proxifyIfSupported(doAsserterAsyncAndAddThen(originalGetter, this));
            });
        }
    });

    function doAsserterAsyncAndAddThen(asserter, assertion, args) {
        // Since we're intercepting all methods/properties, we need to just pass through if they don't want
        // `eventually`, or if we've already fulfilled the promise (see below).
        if (!utils.flag(assertion, "eventually")) {
            asserter.apply(assertion, args);
            return assertion;
        }

        const derivedPromise = getBasePromise(assertion).then(value => {
            // Set up the environment for the asserter to actually run: `_obj` should be the fulfillment value, and
            // now that we have the value, we're no longer in "eventually" mode, so we won't run any of this code,
            // just the base Chai code that we get to via the short-circuit above.
            assertion._obj = value;
            utils.flag(assertion, "eventually", false);

            return args ? module.exports.transformAsserterArgs(args) : args;
        }).then(newArgs => {
            asserter.apply(assertion, newArgs);

            // Because asserters, for example `property`, can change the value of `_obj` (i.e. change the "object"
            // flag), we need to communicate this value change to subsequent chained asserters. Since we build a
            // promise chain paralleling the asserter chain, we can use it to communicate such changes.
            return assertion._obj;
        });

        module.exports.transferPromiseness(assertion, derivedPromise);
        return assertion;
    }

    // ### Now use the `Assertion` framework to build an `assert` interface.
    const originalAssertMethods = Object.getOwnPropertyNames(assert).filter(propName => {
        return typeof assert[propName] === "function";
    });

    assert.isFulfilled = (promise, message) => (new Assertion(promise, message)).to.be.fulfilled;

    assert.isRejected = (promise, errorLike, errMsgMatcher, message) => {
        const assertion = new Assertion(promise, message);
        return assertion.to.be.rejectedWith(errorLike, errMsgMatcher, message);
    };

    assert.becomes = (promise, value, message) => assert.eventually.deepEqual(promise, value, message);

    assert.doesNotBecome = (promise, value, message) => assert.eventually.notDeepEqual(promise, value, message);

    assert.eventually = {};
    originalAssertMethods.forEach(assertMethodName => {
        assert.eventually[assertMethodName] = function (promise) {
            const otherArgs = Array.prototype.slice.call(arguments, 1);

            let customRejectionHandler;
            const message = arguments[assert[assertMethodName].length - 1];
            if (typeof message === "string") {
                customRejectionHandler = reason => {
                    throw new chai.AssertionError(`${message}\n\nOriginal reason: ${utils.inspect(reason)}`);
                };
            }

            const returnedPromise = promise.then(
                fulfillmentValue => assert[assertMethodName].apply(assert, [fulfillmentValue].concat(otherArgs)),
                customRejectionHandler
            );

            returnedPromise.notify = done => {
                doNotify(returnedPromise, done);
            };

            return returnedPromise;
        };
    });
};

module.exports.transferPromiseness = (assertion, promise) => {
    assertion.then = promise.then.bind(promise);
};

module.exports.transformAsserterArgs = values => values;

},{"check-error":35}],3:[function(require,module,exports){
module.exports = require('./lib/chai');

},{"./lib/chai":4}],4:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var used = [];

/*!
 * Chai version
 */

exports.version = '4.2.0';

/*!
 * Assertion Error
 */

exports.AssertionError = require('assertion-error');

/*!
 * Utils for plugins (not exported)
 */

var util = require('./chai/utils');

/**
 * # .use(function)
 *
 * Provides a way to extend the internals of Chai.
 *
 * @param {Function}
 * @returns {this} for chaining
 * @api public
 */

exports.use = function (fn) {
  if (!~used.indexOf(fn)) {
    fn(exports, util);
    used.push(fn);
  }

  return exports;
};

/*!
 * Utility Functions
 */

exports.util = util;

/*!
 * Configuration
 */

var config = require('./chai/config');
exports.config = config;

/*!
 * Primary `Assertion` prototype
 */

var assertion = require('./chai/assertion');
exports.use(assertion);

/*!
 * Core Assertions
 */

var core = require('./chai/core/assertions');
exports.use(core);

/*!
 * Expect interface
 */

var expect = require('./chai/interface/expect');
exports.use(expect);

/*!
 * Should interface
 */

var should = require('./chai/interface/should');
exports.use(should);

/*!
 * Assert interface
 */

var assert = require('./chai/interface/assert');
exports.use(assert);

},{"./chai/assertion":5,"./chai/config":6,"./chai/core/assertions":7,"./chai/interface/assert":8,"./chai/interface/expect":9,"./chai/interface/should":10,"./chai/utils":24,"assertion-error":1}],5:[function(require,module,exports){
/*!
 * chai
 * http://chaijs.com
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var config = require('./config');

module.exports = function (_chai, util) {
  /*!
   * Module dependencies.
   */

  var AssertionError = _chai.AssertionError
    , flag = util.flag;

  /*!
   * Module export.
   */

  _chai.Assertion = Assertion;

  /*!
   * Assertion Constructor
   *
   * Creates object for chaining.
   *
   * `Assertion` objects contain metadata in the form of flags. Three flags can
   * be assigned during instantiation by passing arguments to this constructor:
   *
   * - `object`: This flag contains the target of the assertion. For example, in
   *   the assertion `expect(numKittens).to.equal(7);`, the `object` flag will
   *   contain `numKittens` so that the `equal` assertion can reference it when
   *   needed.
   *
   * - `message`: This flag contains an optional custom error message to be
   *   prepended to the error message that's generated by the assertion when it
   *   fails.
   *
   * - `ssfi`: This flag stands for "start stack function indicator". It
   *   contains a function reference that serves as the starting point for
   *   removing frames from the stack trace of the error that's created by the
   *   assertion when it fails. The goal is to provide a cleaner stack trace to
   *   end users by removing Chai's internal functions. Note that it only works
   *   in environments that support `Error.captureStackTrace`, and only when
   *   `Chai.config.includeStack` hasn't been set to `false`.
   *
   * - `lockSsfi`: This flag controls whether or not the given `ssfi` flag
   *   should retain its current value, even as assertions are chained off of
   *   this object. This is usually set to `true` when creating a new assertion
   *   from within another assertion. It's also temporarily set to `true` before
   *   an overwritten assertion gets called by the overwriting assertion.
   *
   * @param {Mixed} obj target of the assertion
   * @param {String} msg (optional) custom error message
   * @param {Function} ssfi (optional) starting point for removing stack frames
   * @param {Boolean} lockSsfi (optional) whether or not the ssfi flag is locked
   * @api private
   */

  function Assertion (obj, msg, ssfi, lockSsfi) {
    flag(this, 'ssfi', ssfi || Assertion);
    flag(this, 'lockSsfi', lockSsfi);
    flag(this, 'object', obj);
    flag(this, 'message', msg);

    return util.proxify(this);
  }

  Object.defineProperty(Assertion, 'includeStack', {
    get: function() {
      console.warn('Assertion.includeStack is deprecated, use chai.config.includeStack instead.');
      return config.includeStack;
    },
    set: function(value) {
      console.warn('Assertion.includeStack is deprecated, use chai.config.includeStack instead.');
      config.includeStack = value;
    }
  });

  Object.defineProperty(Assertion, 'showDiff', {
    get: function() {
      console.warn('Assertion.showDiff is deprecated, use chai.config.showDiff instead.');
      return config.showDiff;
    },
    set: function(value) {
      console.warn('Assertion.showDiff is deprecated, use chai.config.showDiff instead.');
      config.showDiff = value;
    }
  });

  Assertion.addProperty = function (name, fn) {
    util.addProperty(this.prototype, name, fn);
  };

  Assertion.addMethod = function (name, fn) {
    util.addMethod(this.prototype, name, fn);
  };

  Assertion.addChainableMethod = function (name, fn, chainingBehavior) {
    util.addChainableMethod(this.prototype, name, fn, chainingBehavior);
  };

  Assertion.overwriteProperty = function (name, fn) {
    util.overwriteProperty(this.prototype, name, fn);
  };

  Assertion.overwriteMethod = function (name, fn) {
    util.overwriteMethod(this.prototype, name, fn);
  };

  Assertion.overwriteChainableMethod = function (name, fn, chainingBehavior) {
    util.overwriteChainableMethod(this.prototype, name, fn, chainingBehavior);
  };

  /**
   * ### .assert(expression, message, negateMessage, expected, actual, showDiff)
   *
   * Executes an expression and check expectations. Throws AssertionError for reporting if test doesn't pass.
   *
   * @name assert
   * @param {Philosophical} expression to be tested
   * @param {String|Function} message or function that returns message to display if expression fails
   * @param {String|Function} negatedMessage or function that returns negatedMessage to display if negated expression fails
   * @param {Mixed} expected value (remember to check for negation)
   * @param {Mixed} actual (optional) will default to `this.obj`
   * @param {Boolean} showDiff (optional) when set to `true`, assert will display a diff in addition to the message if expression fails
   * @api private
   */

  Assertion.prototype.assert = function (expr, msg, negateMsg, expected, _actual, showDiff) {
    var ok = util.test(this, arguments);
    if (false !== showDiff) showDiff = true;
    if (undefined === expected && undefined === _actual) showDiff = false;
    if (true !== config.showDiff) showDiff = false;

    if (!ok) {
      msg = util.getMessage(this, arguments);
      var actual = util.getActual(this, arguments);
      throw new AssertionError(msg, {
          actual: actual
        , expected: expected
        , showDiff: showDiff
      }, (config.includeStack) ? this.assert : flag(this, 'ssfi'));
    }
  };

  /*!
   * ### ._obj
   *
   * Quick reference to stored `actual` value for plugin developers.
   *
   * @api private
   */

  Object.defineProperty(Assertion.prototype, '_obj',
    { get: function () {
        return flag(this, 'object');
      }
    , set: function (val) {
        flag(this, 'object', val);
      }
  });
};

},{"./config":6}],6:[function(require,module,exports){
module.exports = {

  /**
   * ### config.includeStack
   *
   * User configurable property, influences whether stack trace
   * is included in Assertion error message. Default of false
   * suppresses stack trace in the error message.
   *
   *     chai.config.includeStack = true;  // enable stack on error
   *
   * @param {Boolean}
   * @api public
   */

  includeStack: false,

  /**
   * ### config.showDiff
   *
   * User configurable property, influences whether or not
   * the `showDiff` flag should be included in the thrown
   * AssertionErrors. `false` will always be `false`; `true`
   * will be true when the assertion has requested a diff
   * be shown.
   *
   * @param {Boolean}
   * @api public
   */

  showDiff: true,

  /**
   * ### config.truncateThreshold
   *
   * User configurable property, sets length threshold for actual and
   * expected values in assertion errors. If this threshold is exceeded, for
   * example for large data structures, the value is replaced with something
   * like `[ Array(3) ]` or `{ Object (prop1, prop2) }`.
   *
   * Set it to zero if you want to disable truncating altogether.
   *
   * This is especially userful when doing assertions on arrays: having this
   * set to a reasonable large value makes the failure messages readily
   * inspectable.
   *
   *     chai.config.truncateThreshold = 0;  // disable truncating
   *
   * @param {Number}
   * @api public
   */

  truncateThreshold: 40,

  /**
   * ### config.useProxy
   *
   * User configurable property, defines if chai will use a Proxy to throw
   * an error when a non-existent property is read, which protects users
   * from typos when using property-based assertions.
   *
   * Set it to false if you want to disable this feature.
   *
   *     chai.config.useProxy = false;  // disable use of Proxy
   *
   * This feature is automatically disabled regardless of this config value
   * in environments that don't support proxies.
   *
   * @param {Boolean}
   * @api public
   */

  useProxy: true,

  /**
   * ### config.proxyExcludedKeys
   *
   * User configurable property, defines which properties should be ignored
   * instead of throwing an error if they do not exist on the assertion.
   * This is only applied if the environment Chai is running in supports proxies and
   * if the `useProxy` configuration setting is enabled.
   * By default, `then` and `inspect` will not throw an error if they do not exist on the
   * assertion object because the `.inspect` property is read by `util.inspect` (for example, when
   * using `console.log` on the assertion object) and `.then` is necessary for promise type-checking.
   *
   *     // By default these keys will not throw an error if they do not exist on the assertion object
   *     chai.config.proxyExcludedKeys = ['then', 'inspect'];
   *
   * @param {Array}
   * @api public
   */

  proxyExcludedKeys: ['then', 'catch', 'inspect', 'toJSON']
};

},{}],7:[function(require,module,exports){
/*!
 * chai
 * http://chaijs.com
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, _) {
  var Assertion = chai.Assertion
    , AssertionError = chai.AssertionError
    , flag = _.flag;

  /**
   * ### Language Chains
   *
   * The following are provided as chainable getters to improve the readability
   * of your assertions.
   *
   * **Chains**
   *
   * - to
   * - be
   * - been
   * - is
   * - that
   * - which
   * - and
   * - has
   * - have
   * - with
   * - at
   * - of
   * - same
   * - but
   * - does
   * - still
   *
   * @name language chains
   * @namespace BDD
   * @api public
   */

  [ 'to', 'be', 'been', 'is'
  , 'and', 'has', 'have', 'with'
  , 'that', 'which', 'at', 'of'
  , 'same', 'but', 'does', 'still' ].forEach(function (chain) {
    Assertion.addProperty(chain);
  });

  /**
   * ### .not
   *
   * Negates all assertions that follow in the chain.
   *
   *     expect(function () {}).to.not.throw();
   *     expect({a: 1}).to.not.have.property('b');
   *     expect([1, 2]).to.be.an('array').that.does.not.include(3);
   *
   * Just because you can negate any assertion with `.not` doesn't mean you
   * should. With great power comes great responsibility. It's often best to
   * assert that the one expected output was produced, rather than asserting
   * that one of countless unexpected outputs wasn't produced. See individual
   * assertions for specific guidance.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.not.equal(1); // Not recommended
   *
   * @name not
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('not', function () {
    flag(this, 'negate', true);
  });

  /**
   * ### .deep
   *
   * Causes all `.equal`, `.include`, `.members`, `.keys`, and `.property`
   * assertions that follow in the chain to use deep equality instead of strict
   * (`===`) equality. See the `deep-eql` project page for info on the deep
   * equality algorithm: https://github.com/chaijs/deep-eql.
   *
   *     // Target object deeply (but not strictly) equals `{a: 1}`
   *     expect({a: 1}).to.deep.equal({a: 1});
   *     expect({a: 1}).to.not.equal({a: 1});
   *
   *     // Target array deeply (but not strictly) includes `{a: 1}`
   *     expect([{a: 1}]).to.deep.include({a: 1});
   *     expect([{a: 1}]).to.not.include({a: 1});
   *
   *     // Target object deeply (but not strictly) includes `x: {a: 1}`
   *     expect({x: {a: 1}}).to.deep.include({x: {a: 1}});
   *     expect({x: {a: 1}}).to.not.include({x: {a: 1}});
   *
   *     // Target array deeply (but not strictly) has member `{a: 1}`
   *     expect([{a: 1}]).to.have.deep.members([{a: 1}]);
   *     expect([{a: 1}]).to.not.have.members([{a: 1}]);
   *
   *     // Target set deeply (but not strictly) has key `{a: 1}`
   *     expect(new Set([{a: 1}])).to.have.deep.keys([{a: 1}]);
   *     expect(new Set([{a: 1}])).to.not.have.keys([{a: 1}]);
   *
   *     // Target object deeply (but not strictly) has property `x: {a: 1}`
   *     expect({x: {a: 1}}).to.have.deep.property('x', {a: 1});
   *     expect({x: {a: 1}}).to.not.have.property('x', {a: 1});
   *
   * @name deep
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('deep', function () {
    flag(this, 'deep', true);
  });

  /**
   * ### .nested
   *
   * Enables dot- and bracket-notation in all `.property` and `.include`
   * assertions that follow in the chain.
   *
   *     expect({a: {b: ['x', 'y']}}).to.have.nested.property('a.b[1]');
   *     expect({a: {b: ['x', 'y']}}).to.nested.include({'a.b[1]': 'y'});
   *
   * If `.` or `[]` are part of an actual property name, they can be escaped by
   * adding two backslashes before them.
   *
   *     expect({'.a': {'[b]': 'x'}}).to.have.nested.property('\\.a.\\[b\\]');
   *     expect({'.a': {'[b]': 'x'}}).to.nested.include({'\\.a.\\[b\\]': 'x'});
   *
   * `.nested` cannot be combined with `.own`.
   *
   * @name nested
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('nested', function () {
    flag(this, 'nested', true);
  });

  /**
   * ### .own
   *
   * Causes all `.property` and `.include` assertions that follow in the chain
   * to ignore inherited properties.
   *
   *     Object.prototype.b = 2;
   *
   *     expect({a: 1}).to.have.own.property('a');
   *     expect({a: 1}).to.have.property('b');
   *     expect({a: 1}).to.not.have.own.property('b');
   *
   *     expect({a: 1}).to.own.include({a: 1});
   *     expect({a: 1}).to.include({b: 2}).but.not.own.include({b: 2});
   *
   * `.own` cannot be combined with `.nested`.
   *
   * @name own
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('own', function () {
    flag(this, 'own', true);
  });

  /**
   * ### .ordered
   *
   * Causes all `.members` assertions that follow in the chain to require that
   * members be in the same order.
   *
   *     expect([1, 2]).to.have.ordered.members([1, 2])
   *       .but.not.have.ordered.members([2, 1]);
   *
   * When `.include` and `.ordered` are combined, the ordering begins at the
   * start of both arrays.
   *
   *     expect([1, 2, 3]).to.include.ordered.members([1, 2])
   *       .but.not.include.ordered.members([2, 3]);
   *
   * @name ordered
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('ordered', function () {
    flag(this, 'ordered', true);
  });

  /**
   * ### .any
   *
   * Causes all `.keys` assertions that follow in the chain to only require that
   * the target have at least one of the given keys. This is the opposite of
   * `.all`, which requires that the target have all of the given keys.
   *
   *     expect({a: 1, b: 2}).to.not.have.any.keys('c', 'd');
   *
   * See the `.keys` doc for guidance on when to use `.any` or `.all`.
   *
   * @name any
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('any', function () {
    flag(this, 'any', true);
    flag(this, 'all', false);
  });

  /**
   * ### .all
   *
   * Causes all `.keys` assertions that follow in the chain to require that the
   * target have all of the given keys. This is the opposite of `.any`, which
   * only requires that the target have at least one of the given keys.
   *
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b');
   *
   * Note that `.all` is used by default when neither `.all` nor `.any` are
   * added earlier in the chain. However, it's often best to add `.all` anyway
   * because it improves readability.
   *
   * See the `.keys` doc for guidance on when to use `.any` or `.all`.
   *
   * @name all
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('all', function () {
    flag(this, 'all', true);
    flag(this, 'any', false);
  });

  /**
   * ### .a(type[, msg])
   *
   * Asserts that the target's type is equal to the given string `type`. Types
   * are case insensitive. See the `type-detect` project page for info on the
   * type detection algorithm: https://github.com/chaijs/type-detect.
   *
   *     expect('foo').to.be.a('string');
   *     expect({a: 1}).to.be.an('object');
   *     expect(null).to.be.a('null');
   *     expect(undefined).to.be.an('undefined');
   *     expect(new Error).to.be.an('error');
   *     expect(Promise.resolve()).to.be.a('promise');
   *     expect(new Float32Array).to.be.a('float32array');
   *     expect(Symbol()).to.be.a('symbol');
   *
   * `.a` supports objects that have a custom type set via `Symbol.toStringTag`.
   *
   *     var myObj = {
   *       [Symbol.toStringTag]: 'myCustomType'
   *     };
   *
   *     expect(myObj).to.be.a('myCustomType').but.not.an('object');
   *
   * It's often best to use `.a` to check a target's type before making more
   * assertions on the same target. That way, you avoid unexpected behavior from
   * any assertion that does different things based on the target's type.
   *
   *     expect([1, 2, 3]).to.be.an('array').that.includes(2);
   *     expect([]).to.be.an('array').that.is.empty;
   *
   * Add `.not` earlier in the chain to negate `.a`. However, it's often best to
   * assert that the target is the expected type, rather than asserting that it
   * isn't one of many unexpected types.
   *
   *     expect('foo').to.be.a('string'); // Recommended
   *     expect('foo').to.not.be.an('array'); // Not recommended
   *
   * `.a` accepts an optional `msg` argument which is a custom error message to
   * show when the assertion fails. The message can also be given as the second
   * argument to `expect`.
   *
   *     expect(1).to.be.a('string', 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.a('string');
   *
   * `.a` can also be used as a language chain to improve the readability of
   * your assertions.
   *
   *     expect({b: 2}).to.have.a.property('b');
   *
   * The alias `.an` can be used interchangeably with `.a`.
   *
   * @name a
   * @alias an
   * @param {String} type
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function an (type, msg) {
    if (msg) flag(this, 'message', msg);
    type = type.toLowerCase();
    var obj = flag(this, 'object')
      , article = ~[ 'a', 'e', 'i', 'o', 'u' ].indexOf(type.charAt(0)) ? 'an ' : 'a ';

    this.assert(
        type === _.type(obj).toLowerCase()
      , 'expected #{this} to be ' + article + type
      , 'expected #{this} not to be ' + article + type
    );
  }

  Assertion.addChainableMethod('an', an);
  Assertion.addChainableMethod('a', an);

  /**
   * ### .include(val[, msg])
   *
   * When the target is a string, `.include` asserts that the given string `val`
   * is a substring of the target.
   *
   *     expect('foobar').to.include('foo');
   *
   * When the target is an array, `.include` asserts that the given `val` is a
   * member of the target.
   *
   *     expect([1, 2, 3]).to.include(2);
   *
   * When the target is an object, `.include` asserts that the given object
   * `val`'s properties are a subset of the target's properties.
   *
   *     expect({a: 1, b: 2, c: 3}).to.include({a: 1, b: 2});
   *
   * When the target is a Set or WeakSet, `.include` asserts that the given `val` is a
   * member of the target. SameValueZero equality algorithm is used.
   *
   *     expect(new Set([1, 2])).to.include(2);
   *
   * When the target is a Map, `.include` asserts that the given `val` is one of
   * the values of the target. SameValueZero equality algorithm is used.
   *
   *     expect(new Map([['a', 1], ['b', 2]])).to.include(2);
   *
   * Because `.include` does different things based on the target's type, it's
   * important to check the target's type before using `.include`. See the `.a`
   * doc for info on testing a target's type.
   *
   *     expect([1, 2, 3]).to.be.an('array').that.includes(2);
   *
   * By default, strict (`===`) equality is used to compare array members and
   * object properties. Add `.deep` earlier in the chain to use deep equality
   * instead (WeakSet targets are not supported). See the `deep-eql` project
   * page for info on the deep equality algorithm: https://github.com/chaijs/deep-eql.
   *
   *     // Target array deeply (but not strictly) includes `{a: 1}`
   *     expect([{a: 1}]).to.deep.include({a: 1});
   *     expect([{a: 1}]).to.not.include({a: 1});
   *
   *     // Target object deeply (but not strictly) includes `x: {a: 1}`
   *     expect({x: {a: 1}}).to.deep.include({x: {a: 1}});
   *     expect({x: {a: 1}}).to.not.include({x: {a: 1}});
   *
   * By default, all of the target's properties are searched when working with
   * objects. This includes properties that are inherited and/or non-enumerable.
   * Add `.own` earlier in the chain to exclude the target's inherited
   * properties from the search.
   *
   *     Object.prototype.b = 2;
   *
   *     expect({a: 1}).to.own.include({a: 1});
   *     expect({a: 1}).to.include({b: 2}).but.not.own.include({b: 2});
   *
   * Note that a target object is always only searched for `val`'s own
   * enumerable properties.
   *
   * `.deep` and `.own` can be combined.
   *
   *     expect({a: {b: 2}}).to.deep.own.include({a: {b: 2}});
   *
   * Add `.nested` earlier in the chain to enable dot- and bracket-notation when
   * referencing nested properties.
   *
   *     expect({a: {b: ['x', 'y']}}).to.nested.include({'a.b[1]': 'y'});
   *
   * If `.` or `[]` are part of an actual property name, they can be escaped by
   * adding two backslashes before them.
   *
   *     expect({'.a': {'[b]': 2}}).to.nested.include({'\\.a.\\[b\\]': 2});
   *
   * `.deep` and `.nested` can be combined.
   *
   *     expect({a: {b: [{c: 3}]}}).to.deep.nested.include({'a.b[0]': {c: 3}});
   *
   * `.own` and `.nested` cannot be combined.
   *
   * Add `.not` earlier in the chain to negate `.include`.
   *
   *     expect('foobar').to.not.include('taco');
   *     expect([1, 2, 3]).to.not.include(4);
   *
   * However, it's dangerous to negate `.include` when the target is an object.
   * The problem is that it creates uncertain expectations by asserting that the
   * target object doesn't have all of `val`'s key/value pairs but may or may
   * not have some of them. It's often best to identify the exact output that's
   * expected, and then write an assertion that only accepts that exact output.
   *
   * When the target object isn't even expected to have `val`'s keys, it's
   * often best to assert exactly that.
   *
   *     expect({c: 3}).to.not.have.any.keys('a', 'b'); // Recommended
   *     expect({c: 3}).to.not.include({a: 1, b: 2}); // Not recommended
   *
   * When the target object is expected to have `val`'s keys, it's often best to
   * assert that each of the properties has its expected value, rather than
   * asserting that each property doesn't have one of many unexpected values.
   *
   *     expect({a: 3, b: 4}).to.include({a: 3, b: 4}); // Recommended
   *     expect({a: 3, b: 4}).to.not.include({a: 1, b: 2}); // Not recommended
   *
   * `.include` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect([1, 2, 3]).to.include(4, 'nooo why fail??');
   *     expect([1, 2, 3], 'nooo why fail??').to.include(4);
   *
   * `.include` can also be used as a language chain, causing all `.members` and
   * `.keys` assertions that follow in the chain to require the target to be a
   * superset of the expected set, rather than an identical set. Note that
   * `.members` ignores duplicates in the subset when `.include` is added.
   *
   *     // Target object's keys are a superset of ['a', 'b'] but not identical
   *     expect({a: 1, b: 2, c: 3}).to.include.all.keys('a', 'b');
   *     expect({a: 1, b: 2, c: 3}).to.not.have.all.keys('a', 'b');
   *
   *     // Target array is a superset of [1, 2] but not identical
   *     expect([1, 2, 3]).to.include.members([1, 2]);
   *     expect([1, 2, 3]).to.not.have.members([1, 2]);
   *
   *     // Duplicates in the subset are ignored
   *     expect([1, 2, 3]).to.include.members([1, 2, 2, 2]);
   *
   * Note that adding `.any` earlier in the chain causes the `.keys` assertion
   * to ignore `.include`.
   *
   *     // Both assertions are identical
   *     expect({a: 1}).to.include.any.keys('a', 'b');
   *     expect({a: 1}).to.have.any.keys('a', 'b');
   *
   * The aliases `.includes`, `.contain`, and `.contains` can be used
   * interchangeably with `.include`.
   *
   * @name include
   * @alias contain
   * @alias includes
   * @alias contains
   * @param {Mixed} val
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function SameValueZero(a, b) {
    return (_.isNaN(a) && _.isNaN(b)) || a === b;
  }

  function includeChainingBehavior () {
    flag(this, 'contains', true);
  }

  function include (val, msg) {
    if (msg) flag(this, 'message', msg);

    var obj = flag(this, 'object')
      , objType = _.type(obj).toLowerCase()
      , flagMsg = flag(this, 'message')
      , negate = flag(this, 'negate')
      , ssfi = flag(this, 'ssfi')
      , isDeep = flag(this, 'deep')
      , descriptor = isDeep ? 'deep ' : '';

    flagMsg = flagMsg ? flagMsg + ': ' : '';

    var included = false;

    switch (objType) {
      case 'string':
        included = obj.indexOf(val) !== -1;
        break;

      case 'weakset':
        if (isDeep) {
          throw new AssertionError(
            flagMsg + 'unable to use .deep.include with WeakSet',
            undefined,
            ssfi
          );
        }

        included = obj.has(val);
        break;

      case 'map':
        var isEql = isDeep ? _.eql : SameValueZero;
        obj.forEach(function (item) {
          included = included || isEql(item, val);
        });
        break;

      case 'set':
        if (isDeep) {
          obj.forEach(function (item) {
            included = included || _.eql(item, val);
          });
        } else {
          included = obj.has(val);
        }
        break;

      case 'array':
        if (isDeep) {
          included = obj.some(function (item) {
            return _.eql(item, val);
          })
        } else {
          included = obj.indexOf(val) !== -1;
        }
        break;

      default:
        // This block is for asserting a subset of properties in an object.
        // `_.expectTypes` isn't used here because `.include` should work with
        // objects with a custom `@@toStringTag`.
        if (val !== Object(val)) {
          throw new AssertionError(
            flagMsg + 'object tested must be an array, a map, an object,'
              + ' a set, a string, or a weakset, but ' + objType + ' given',
            undefined,
            ssfi
          );
        }

        var props = Object.keys(val)
          , firstErr = null
          , numErrs = 0;

        props.forEach(function (prop) {
          var propAssertion = new Assertion(obj);
          _.transferFlags(this, propAssertion, true);
          flag(propAssertion, 'lockSsfi', true);

          if (!negate || props.length === 1) {
            propAssertion.property(prop, val[prop]);
            return;
          }

          try {
            propAssertion.property(prop, val[prop]);
          } catch (err) {
            if (!_.checkError.compatibleConstructor(err, AssertionError)) {
              throw err;
            }
            if (firstErr === null) firstErr = err;
            numErrs++;
          }
        }, this);

        // When validating .not.include with multiple properties, we only want
        // to throw an assertion error if all of the properties are included,
        // in which case we throw the first property assertion error that we
        // encountered.
        if (negate && props.length > 1 && numErrs === props.length) {
          throw firstErr;
        }
        return;
    }

    // Assert inclusion in collection or substring in a string.
    this.assert(
      included
      , 'expected #{this} to ' + descriptor + 'include ' + _.inspect(val)
      , 'expected #{this} to not ' + descriptor + 'include ' + _.inspect(val));
  }

  Assertion.addChainableMethod('include', include, includeChainingBehavior);
  Assertion.addChainableMethod('contain', include, includeChainingBehavior);
  Assertion.addChainableMethod('contains', include, includeChainingBehavior);
  Assertion.addChainableMethod('includes', include, includeChainingBehavior);

  /**
   * ### .ok
   *
   * Asserts that the target is a truthy value (considered `true` in boolean context).
   * However, it's often best to assert that the target is strictly (`===`) or
   * deeply equal to its expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.ok; // Not recommended
   *
   *     expect(true).to.be.true; // Recommended
   *     expect(true).to.be.ok; // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.ok`.
   *
   *     expect(0).to.equal(0); // Recommended
   *     expect(0).to.not.be.ok; // Not recommended
   *
   *     expect(false).to.be.false; // Recommended
   *     expect(false).to.not.be.ok; // Not recommended
   *
   *     expect(null).to.be.null; // Recommended
   *     expect(null).to.not.be.ok; // Not recommended
   *
   *     expect(undefined).to.be.undefined; // Recommended
   *     expect(undefined).to.not.be.ok; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(false, 'nooo why fail??').to.be.ok;
   *
   * @name ok
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('ok', function () {
    this.assert(
        flag(this, 'object')
      , 'expected #{this} to be truthy'
      , 'expected #{this} to be falsy');
  });

  /**
   * ### .true
   *
   * Asserts that the target is strictly (`===`) equal to `true`.
   *
   *     expect(true).to.be.true;
   *
   * Add `.not` earlier in the chain to negate `.true`. However, it's often best
   * to assert that the target is equal to its expected value, rather than not
   * equal to `true`.
   *
   *     expect(false).to.be.false; // Recommended
   *     expect(false).to.not.be.true; // Not recommended
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.true; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(false, 'nooo why fail??').to.be.true;
   *
   * @name true
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('true', function () {
    this.assert(
        true === flag(this, 'object')
      , 'expected #{this} to be true'
      , 'expected #{this} to be false'
      , flag(this, 'negate') ? false : true
    );
  });

  /**
   * ### .false
   *
   * Asserts that the target is strictly (`===`) equal to `false`.
   *
   *     expect(false).to.be.false;
   *
   * Add `.not` earlier in the chain to negate `.false`. However, it's often
   * best to assert that the target is equal to its expected value, rather than
   * not equal to `false`.
   *
   *     expect(true).to.be.true; // Recommended
   *     expect(true).to.not.be.false; // Not recommended
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.false; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(true, 'nooo why fail??').to.be.false;
   *
   * @name false
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('false', function () {
    this.assert(
        false === flag(this, 'object')
      , 'expected #{this} to be false'
      , 'expected #{this} to be true'
      , flag(this, 'negate') ? true : false
    );
  });

  /**
   * ### .null
   *
   * Asserts that the target is strictly (`===`) equal to `null`.
   *
   *     expect(null).to.be.null;
   *
   * Add `.not` earlier in the chain to negate `.null`. However, it's often best
   * to assert that the target is equal to its expected value, rather than not
   * equal to `null`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.null; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(42, 'nooo why fail??').to.be.null;
   *
   * @name null
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('null', function () {
    this.assert(
        null === flag(this, 'object')
      , 'expected #{this} to be null'
      , 'expected #{this} not to be null'
    );
  });

  /**
   * ### .undefined
   *
   * Asserts that the target is strictly (`===`) equal to `undefined`.
   *
   *     expect(undefined).to.be.undefined;
   *
   * Add `.not` earlier in the chain to negate `.undefined`. However, it's often
   * best to assert that the target is equal to its expected value, rather than
   * not equal to `undefined`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.undefined; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(42, 'nooo why fail??').to.be.undefined;
   *
   * @name undefined
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('undefined', function () {
    this.assert(
        undefined === flag(this, 'object')
      , 'expected #{this} to be undefined'
      , 'expected #{this} not to be undefined'
    );
  });

  /**
   * ### .NaN
   *
   * Asserts that the target is exactly `NaN`.
   *
   *     expect(NaN).to.be.NaN;
   *
   * Add `.not` earlier in the chain to negate `.NaN`. However, it's often best
   * to assert that the target is equal to its expected value, rather than not
   * equal to `NaN`.
   *
   *     expect('foo').to.equal('foo'); // Recommended
   *     expect('foo').to.not.be.NaN; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(42, 'nooo why fail??').to.be.NaN;
   *
   * @name NaN
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('NaN', function () {
    this.assert(
        _.isNaN(flag(this, 'object'))
        , 'expected #{this} to be NaN'
        , 'expected #{this} not to be NaN'
    );
  });

  /**
   * ### .exist
   *
   * Asserts that the target is not strictly (`===`) equal to either `null` or
   * `undefined`. However, it's often best to assert that the target is equal to
   * its expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.exist; // Not recommended
   *
   *     expect(0).to.equal(0); // Recommended
   *     expect(0).to.exist; // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.exist`.
   *
   *     expect(null).to.be.null; // Recommended
   *     expect(null).to.not.exist; // Not recommended
   *
   *     expect(undefined).to.be.undefined; // Recommended
   *     expect(undefined).to.not.exist; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(null, 'nooo why fail??').to.exist;
   *
   * @name exist
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('exist', function () {
    var val = flag(this, 'object');
    this.assert(
        val !== null && val !== undefined
      , 'expected #{this} to exist'
      , 'expected #{this} to not exist'
    );
  });

  /**
   * ### .empty
   *
   * When the target is a string or array, `.empty` asserts that the target's
   * `length` property is strictly (`===`) equal to `0`.
   *
   *     expect([]).to.be.empty;
   *     expect('').to.be.empty;
   *
   * When the target is a map or set, `.empty` asserts that the target's `size`
   * property is strictly equal to `0`.
   *
   *     expect(new Set()).to.be.empty;
   *     expect(new Map()).to.be.empty;
   *
   * When the target is a non-function object, `.empty` asserts that the target
   * doesn't have any own enumerable properties. Properties with Symbol-based
   * keys are excluded from the count.
   *
   *     expect({}).to.be.empty;
   *
   * Because `.empty` does different things based on the target's type, it's
   * important to check the target's type before using `.empty`. See the `.a`
   * doc for info on testing a target's type.
   *
   *     expect([]).to.be.an('array').that.is.empty;
   *
   * Add `.not` earlier in the chain to negate `.empty`. However, it's often
   * best to assert that the target contains its expected number of values,
   * rather than asserting that it's not empty.
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.not.be.empty; // Not recommended
   *
   *     expect(new Set([1, 2, 3])).to.have.property('size', 3); // Recommended
   *     expect(new Set([1, 2, 3])).to.not.be.empty; // Not recommended
   *
   *     expect(Object.keys({a: 1})).to.have.lengthOf(1); // Recommended
   *     expect({a: 1}).to.not.be.empty; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect([1, 2, 3], 'nooo why fail??').to.be.empty;
   *
   * @name empty
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('empty', function () {
    var val = flag(this, 'object')
      , ssfi = flag(this, 'ssfi')
      , flagMsg = flag(this, 'message')
      , itemsCount;

    flagMsg = flagMsg ? flagMsg + ': ' : '';

    switch (_.type(val).toLowerCase()) {
      case 'array':
      case 'string':
        itemsCount = val.length;
        break;
      case 'map':
      case 'set':
        itemsCount = val.size;
        break;
      case 'weakmap':
      case 'weakset':
        throw new AssertionError(
          flagMsg + '.empty was passed a weak collection',
          undefined,
          ssfi
        );
      case 'function':
        var msg = flagMsg + '.empty was passed a function ' + _.getName(val);
        throw new AssertionError(msg.trim(), undefined, ssfi);
      default:
        if (val !== Object(val)) {
          throw new AssertionError(
            flagMsg + '.empty was passed non-string primitive ' + _.inspect(val),
            undefined,
            ssfi
          );
        }
        itemsCount = Object.keys(val).length;
    }

    this.assert(
        0 === itemsCount
      , 'expected #{this} to be empty'
      , 'expected #{this} not to be empty'
    );
  });

  /**
   * ### .arguments
   *
   * Asserts that the target is an `arguments` object.
   *
   *     function test () {
   *       expect(arguments).to.be.arguments;
   *     }
   *
   *     test();
   *
   * Add `.not` earlier in the chain to negate `.arguments`. However, it's often
   * best to assert which type the target is expected to be, rather than
   * asserting that its not an `arguments` object.
   *
   *     expect('foo').to.be.a('string'); // Recommended
   *     expect('foo').to.not.be.arguments; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({}, 'nooo why fail??').to.be.arguments;
   *
   * The alias `.Arguments` can be used interchangeably with `.arguments`.
   *
   * @name arguments
   * @alias Arguments
   * @namespace BDD
   * @api public
   */

  function checkArguments () {
    var obj = flag(this, 'object')
      , type = _.type(obj);
    this.assert(
        'Arguments' === type
      , 'expected #{this} to be arguments but got ' + type
      , 'expected #{this} to not be arguments'
    );
  }

  Assertion.addProperty('arguments', checkArguments);
  Assertion.addProperty('Arguments', checkArguments);

  /**
   * ### .equal(val[, msg])
   *
   * Asserts that the target is strictly (`===`) equal to the given `val`.
   *
   *     expect(1).to.equal(1);
   *     expect('foo').to.equal('foo');
   *
   * Add `.deep` earlier in the chain to use deep equality instead. See the
   * `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target object deeply (but not strictly) equals `{a: 1}`
   *     expect({a: 1}).to.deep.equal({a: 1});
   *     expect({a: 1}).to.not.equal({a: 1});
   *
   *     // Target array deeply (but not strictly) equals `[1, 2]`
   *     expect([1, 2]).to.deep.equal([1, 2]);
   *     expect([1, 2]).to.not.equal([1, 2]);
   *
   * Add `.not` earlier in the chain to negate `.equal`. However, it's often
   * best to assert that the target is equal to its expected value, rather than
   * not equal to one of countless unexpected values.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.equal(2); // Not recommended
   *
   * `.equal` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.equal(2, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.equal(2);
   *
   * The aliases `.equals` and `eq` can be used interchangeably with `.equal`.
   *
   * @name equal
   * @alias equals
   * @alias eq
   * @param {Mixed} val
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertEqual (val, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    if (flag(this, 'deep')) {
      var prevLockSsfi = flag(this, 'lockSsfi');
      flag(this, 'lockSsfi', true);
      this.eql(val);
      flag(this, 'lockSsfi', prevLockSsfi);
    } else {
      this.assert(
          val === obj
        , 'expected #{this} to equal #{exp}'
        , 'expected #{this} to not equal #{exp}'
        , val
        , this._obj
        , true
      );
    }
  }

  Assertion.addMethod('equal', assertEqual);
  Assertion.addMethod('equals', assertEqual);
  Assertion.addMethod('eq', assertEqual);

  /**
   * ### .eql(obj[, msg])
   *
   * Asserts that the target is deeply equal to the given `obj`. See the
   * `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target object is deeply (but not strictly) equal to {a: 1}
   *     expect({a: 1}).to.eql({a: 1}).but.not.equal({a: 1});
   *
   *     // Target array is deeply (but not strictly) equal to [1, 2]
   *     expect([1, 2]).to.eql([1, 2]).but.not.equal([1, 2]);
   *
   * Add `.not` earlier in the chain to negate `.eql`. However, it's often best
   * to assert that the target is deeply equal to its expected value, rather
   * than not deeply equal to one of countless unexpected values.
   *
   *     expect({a: 1}).to.eql({a: 1}); // Recommended
   *     expect({a: 1}).to.not.eql({b: 2}); // Not recommended
   *
   * `.eql` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect({a: 1}).to.eql({b: 2}, 'nooo why fail??');
   *     expect({a: 1}, 'nooo why fail??').to.eql({b: 2});
   *
   * The alias `.eqls` can be used interchangeably with `.eql`.
   *
   * The `.deep.equal` assertion is almost identical to `.eql` but with one
   * difference: `.deep.equal` causes deep equality comparisons to also be used
   * for any other assertions that follow in the chain.
   *
   * @name eql
   * @alias eqls
   * @param {Mixed} obj
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertEql(obj, msg) {
    if (msg) flag(this, 'message', msg);
    this.assert(
        _.eql(obj, flag(this, 'object'))
      , 'expected #{this} to deeply equal #{exp}'
      , 'expected #{this} to not deeply equal #{exp}'
      , obj
      , this._obj
      , true
    );
  }

  Assertion.addMethod('eql', assertEql);
  Assertion.addMethod('eqls', assertEql);

  /**
   * ### .above(n[, msg])
   *
   * Asserts that the target is a number or a date greater than the given number or date `n` respectively.
   * However, it's often best to assert that the target is equal to its expected
   * value.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.be.above(1); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is greater than the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.above(2); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.above(2); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.above`.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(1).to.not.be.above(2); // Not recommended
   *
   * `.above` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.be.above(2, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.above(2);
   *
   * The aliases `.gt` and `.greaterThan` can be used interchangeably with
   * `.above`.
   *
   * @name above
   * @alias gt
   * @alias greaterThan
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertAbove (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to above must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to above must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount > n
        , 'expected #{this} to have a ' + descriptor + ' above #{exp} but got #{act}'
        , 'expected #{this} to not have a ' + descriptor + ' above #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj > n
        , 'expected #{this} to be above #{exp}'
        , 'expected #{this} to be at most #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('above', assertAbove);
  Assertion.addMethod('gt', assertAbove);
  Assertion.addMethod('greaterThan', assertAbove);

  /**
   * ### .least(n[, msg])
   *
   * Asserts that the target is a number or a date greater than or equal to the given
   * number or date `n` respectively. However, it's often best to assert that the target is equal to
   * its expected value.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.be.at.least(1); // Not recommended
   *     expect(2).to.be.at.least(2); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is greater than or equal to the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.at.least(2); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.at.least(2); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.least`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.at.least(2); // Not recommended
   *
   * `.least` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.be.at.least(2, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.at.least(2);
   *
   * The alias `.gte` can be used interchangeably with `.least`.
   *
   * @name least
   * @alias gte
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertLeast (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to least must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to least must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount >= n
        , 'expected #{this} to have a ' + descriptor + ' at least #{exp} but got #{act}'
        , 'expected #{this} to have a ' + descriptor + ' below #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj >= n
        , 'expected #{this} to be at least #{exp}'
        , 'expected #{this} to be below #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('least', assertLeast);
  Assertion.addMethod('gte', assertLeast);

  /**
   * ### .below(n[, msg])
   *
   * Asserts that the target is a number or a date less than the given number or date `n` respectively.
   * However, it's often best to assert that the target is equal to its expected
   * value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.below(2); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is less than the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.below(4); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.length(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.below(4); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.below`.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.not.be.below(1); // Not recommended
   *
   * `.below` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(2).to.be.below(1, 'nooo why fail??');
   *     expect(2, 'nooo why fail??').to.be.below(1);
   *
   * The aliases `.lt` and `.lessThan` can be used interchangeably with
   * `.below`.
   *
   * @name below
   * @alias lt
   * @alias lessThan
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertBelow (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to below must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to below must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount < n
        , 'expected #{this} to have a ' + descriptor + ' below #{exp} but got #{act}'
        , 'expected #{this} to not have a ' + descriptor + ' below #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj < n
        , 'expected #{this} to be below #{exp}'
        , 'expected #{this} to be at least #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('below', assertBelow);
  Assertion.addMethod('lt', assertBelow);
  Assertion.addMethod('lessThan', assertBelow);

  /**
   * ### .most(n[, msg])
   *
   * Asserts that the target is a number or a date less than or equal to the given number
   * or date `n` respectively. However, it's often best to assert that the target is equal to its
   * expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.at.most(2); // Not recommended
   *     expect(1).to.be.at.most(1); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is less than or equal to the given number `n`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.at.most(4); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.at.most(4); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.most`.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.not.be.at.most(1); // Not recommended
   *
   * `.most` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(2).to.be.at.most(1, 'nooo why fail??');
   *     expect(2, 'nooo why fail??').to.be.at.most(1);
   *
   * The alias `.lte` can be used interchangeably with `.most`.
   *
   * @name most
   * @alias lte
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertMost (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , nType = _.type(n).toLowerCase()
      , errorMessage
      , shouldThrow = true;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && nType !== 'date')) {
      errorMessage = msgPrefix + 'the argument to most must be a date';
    } else if (nType !== 'number' && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the argument to most must be a number';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount <= n
        , 'expected #{this} to have a ' + descriptor + ' at most #{exp} but got #{act}'
        , 'expected #{this} to have a ' + descriptor + ' above #{exp}'
        , n
        , itemsCount
      );
    } else {
      this.assert(
          obj <= n
        , 'expected #{this} to be at most #{exp}'
        , 'expected #{this} to be above #{exp}'
        , n
      );
    }
  }

  Assertion.addMethod('most', assertMost);
  Assertion.addMethod('lte', assertMost);

  /**
   * ### .within(start, finish[, msg])
   *
   * Asserts that the target is a number or a date greater than or equal to the given
   * number or date `start`, and less than or equal to the given number or date `finish` respectively.
   * However, it's often best to assert that the target is equal to its expected
   * value.
   *
   *     expect(2).to.equal(2); // Recommended
   *     expect(2).to.be.within(1, 3); // Not recommended
   *     expect(2).to.be.within(2, 3); // Not recommended
   *     expect(2).to.be.within(1, 2); // Not recommended
   *
   * Add `.lengthOf` earlier in the chain to assert that the target's `length`
   * or `size` is greater than or equal to the given number `start`, and less
   * than or equal to the given number `finish`.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.have.lengthOf.within(2, 4); // Not recommended
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3); // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf.within(2, 4); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.within`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.within(2, 4); // Not recommended
   *
   * `.within` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(4).to.be.within(1, 3, 'nooo why fail??');
   *     expect(4, 'nooo why fail??').to.be.within(1, 3);
   *
   * @name within
   * @param {Number} start lower bound inclusive
   * @param {Number} finish upper bound inclusive
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  Assertion.addMethod('within', function (start, finish, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , doLength = flag(this, 'doLength')
      , flagMsg = flag(this, 'message')
      , msgPrefix = ((flagMsg) ? flagMsg + ': ' : '')
      , ssfi = flag(this, 'ssfi')
      , objType = _.type(obj).toLowerCase()
      , startType = _.type(start).toLowerCase()
      , finishType = _.type(finish).toLowerCase()
      , errorMessage
      , shouldThrow = true
      , range = (startType === 'date' && finishType === 'date')
          ? start.toUTCString() + '..' + finish.toUTCString()
          : start + '..' + finish;

    if (doLength && objType !== 'map' && objType !== 'set') {
      new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
    }

    if (!doLength && (objType === 'date' && (startType !== 'date' || finishType !== 'date'))) {
      errorMessage = msgPrefix + 'the arguments to within must be dates';
    } else if ((startType !== 'number' || finishType !== 'number') && (doLength || objType === 'number')) {
      errorMessage = msgPrefix + 'the arguments to within must be numbers';
    } else if (!doLength && (objType !== 'date' && objType !== 'number')) {
      var printObj = (objType === 'string') ? "'" + obj + "'" : obj;
      errorMessage = msgPrefix + 'expected ' + printObj + ' to be a number or a date';
    } else {
      shouldThrow = false;
    }

    if (shouldThrow) {
      throw new AssertionError(errorMessage, undefined, ssfi);
    }

    if (doLength) {
      var descriptor = 'length'
        , itemsCount;
      if (objType === 'map' || objType === 'set') {
        descriptor = 'size';
        itemsCount = obj.size;
      } else {
        itemsCount = obj.length;
      }
      this.assert(
          itemsCount >= start && itemsCount <= finish
        , 'expected #{this} to have a ' + descriptor + ' within ' + range
        , 'expected #{this} to not have a ' + descriptor + ' within ' + range
      );
    } else {
      this.assert(
          obj >= start && obj <= finish
        , 'expected #{this} to be within ' + range
        , 'expected #{this} to not be within ' + range
      );
    }
  });

  /**
   * ### .instanceof(constructor[, msg])
   *
   * Asserts that the target is an instance of the given `constructor`.
   *
   *     function Cat () { }
   *
   *     expect(new Cat()).to.be.an.instanceof(Cat);
   *     expect([1, 2]).to.be.an.instanceof(Array);
   *
   * Add `.not` earlier in the chain to negate `.instanceof`.
   *
   *     expect({a: 1}).to.not.be.an.instanceof(Array);
   *
   * `.instanceof` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(1).to.be.an.instanceof(Array, 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.an.instanceof(Array);
   *
   * Due to limitations in ES5, `.instanceof` may not always work as expected
   * when using a transpiler such as Babel or TypeScript. In particular, it may
   * produce unexpected results when subclassing built-in object such as
   * `Array`, `Error`, and `Map`. See your transpiler's docs for details:
   *
   * - ([Babel](https://babeljs.io/docs/usage/caveats/#classes))
   * - ([TypeScript](https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work))
   *
   * The alias `.instanceOf` can be used interchangeably with `.instanceof`.
   *
   * @name instanceof
   * @param {Constructor} constructor
   * @param {String} msg _optional_
   * @alias instanceOf
   * @namespace BDD
   * @api public
   */

  function assertInstanceOf (constructor, msg) {
    if (msg) flag(this, 'message', msg);

    var target = flag(this, 'object')
    var ssfi = flag(this, 'ssfi');
    var flagMsg = flag(this, 'message');

    try {
      var isInstanceOf = target instanceof constructor;
    } catch (err) {
      if (err instanceof TypeError) {
        flagMsg = flagMsg ? flagMsg + ': ' : '';
        throw new AssertionError(
          flagMsg + 'The instanceof assertion needs a constructor but '
            + _.type(constructor) + ' was given.',
          undefined,
          ssfi
        );
      }
      throw err;
    }

    var name = _.getName(constructor);
    if (name === null) {
      name = 'an unnamed constructor';
    }

    this.assert(
        isInstanceOf
      , 'expected #{this} to be an instance of ' + name
      , 'expected #{this} to not be an instance of ' + name
    );
  };

  Assertion.addMethod('instanceof', assertInstanceOf);
  Assertion.addMethod('instanceOf', assertInstanceOf);

  /**
   * ### .property(name[, val[, msg]])
   *
   * Asserts that the target has a property with the given key `name`.
   *
   *     expect({a: 1}).to.have.property('a');
   *
   * When `val` is provided, `.property` also asserts that the property's value
   * is equal to the given `val`.
   *
   *     expect({a: 1}).to.have.property('a', 1);
   *
   * By default, strict (`===`) equality is used. Add `.deep` earlier in the
   * chain to use deep equality instead. See the `deep-eql` project page for
   * info on the deep equality algorithm: https://github.com/chaijs/deep-eql.
   *
   *     // Target object deeply (but not strictly) has property `x: {a: 1}`
   *     expect({x: {a: 1}}).to.have.deep.property('x', {a: 1});
   *     expect({x: {a: 1}}).to.not.have.property('x', {a: 1});
   *
   * The target's enumerable and non-enumerable properties are always included
   * in the search. By default, both own and inherited properties are included.
   * Add `.own` earlier in the chain to exclude inherited properties from the
   * search.
   *
   *     Object.prototype.b = 2;
   *
   *     expect({a: 1}).to.have.own.property('a');
   *     expect({a: 1}).to.have.own.property('a', 1);
   *     expect({a: 1}).to.have.property('b');
   *     expect({a: 1}).to.not.have.own.property('b');
   *
   * `.deep` and `.own` can be combined.
   *
   *     expect({x: {a: 1}}).to.have.deep.own.property('x', {a: 1});
   *
   * Add `.nested` earlier in the chain to enable dot- and bracket-notation when
   * referencing nested properties.
   *
   *     expect({a: {b: ['x', 'y']}}).to.have.nested.property('a.b[1]');
   *     expect({a: {b: ['x', 'y']}}).to.have.nested.property('a.b[1]', 'y');
   *
   * If `.` or `[]` are part of an actual property name, they can be escaped by
   * adding two backslashes before them.
   *
   *     expect({'.a': {'[b]': 'x'}}).to.have.nested.property('\\.a.\\[b\\]');
   *
   * `.deep` and `.nested` can be combined.
   *
   *     expect({a: {b: [{c: 3}]}})
   *       .to.have.deep.nested.property('a.b[0]', {c: 3});
   *
   * `.own` and `.nested` cannot be combined.
   *
   * Add `.not` earlier in the chain to negate `.property`.
   *
   *     expect({a: 1}).to.not.have.property('b');
   *
   * However, it's dangerous to negate `.property` when providing `val`. The
   * problem is that it creates uncertain expectations by asserting that the
   * target either doesn't have a property with the given key `name`, or that it
   * does have a property with the given key `name` but its value isn't equal to
   * the given `val`. It's often best to identify the exact output that's
   * expected, and then write an assertion that only accepts that exact output.
   *
   * When the target isn't expected to have a property with the given key
   * `name`, it's often best to assert exactly that.
   *
   *     expect({b: 2}).to.not.have.property('a'); // Recommended
   *     expect({b: 2}).to.not.have.property('a', 1); // Not recommended
   *
   * When the target is expected to have a property with the given key `name`,
   * it's often best to assert that the property has its expected value, rather
   * than asserting that it doesn't have one of many unexpected values.
   *
   *     expect({a: 3}).to.have.property('a', 3); // Recommended
   *     expect({a: 3}).to.not.have.property('a', 1); // Not recommended
   *
   * `.property` changes the target of any assertions that follow in the chain
   * to be the value of the property from the original target object.
   *
   *     expect({a: 1}).to.have.property('a').that.is.a('number');
   *
   * `.property` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing `val`, only use the
   * second form.
   *
   *     // Recommended
   *     expect({a: 1}).to.have.property('a', 2, 'nooo why fail??');
   *     expect({a: 1}, 'nooo why fail??').to.have.property('a', 2);
   *     expect({a: 1}, 'nooo why fail??').to.have.property('b');
   *
   *     // Not recommended
   *     expect({a: 1}).to.have.property('b', undefined, 'nooo why fail??');
   *
   * The above assertion isn't the same thing as not providing `val`. Instead,
   * it's asserting that the target object has a `b` property that's equal to
   * `undefined`.
   *
   * The assertions `.ownProperty` and `.haveOwnProperty` can be used
   * interchangeably with `.own.property`.
   *
   * @name property
   * @param {String} name
   * @param {Mixed} val (optional)
   * @param {String} msg _optional_
   * @returns value of property for chaining
   * @namespace BDD
   * @api public
   */

  function assertProperty (name, val, msg) {
    if (msg) flag(this, 'message', msg);

    var isNested = flag(this, 'nested')
      , isOwn = flag(this, 'own')
      , flagMsg = flag(this, 'message')
      , obj = flag(this, 'object')
      , ssfi = flag(this, 'ssfi')
      , nameType = typeof name;

    flagMsg = flagMsg ? flagMsg + ': ' : '';

    if (isNested) {
      if (nameType !== 'string') {
        throw new AssertionError(
          flagMsg + 'the argument to property must be a string when using nested syntax',
          undefined,
          ssfi
        );
      }
    } else {
      if (nameType !== 'string' && nameType !== 'number' && nameType !== 'symbol') {
        throw new AssertionError(
          flagMsg + 'the argument to property must be a string, number, or symbol',
          undefined,
          ssfi
        );
      }
    }

    if (isNested && isOwn) {
      throw new AssertionError(
        flagMsg + 'The "nested" and "own" flags cannot be combined.',
        undefined,
        ssfi
      );
    }

    if (obj === null || obj === undefined) {
      throw new AssertionError(
        flagMsg + 'Target cannot be null or undefined.',
        undefined,
        ssfi
      );
    }

    var isDeep = flag(this, 'deep')
      , negate = flag(this, 'negate')
      , pathInfo = isNested ? _.getPathInfo(obj, name) : null
      , value = isNested ? pathInfo.value : obj[name];

    var descriptor = '';
    if (isDeep) descriptor += 'deep ';
    if (isOwn) descriptor += 'own ';
    if (isNested) descriptor += 'nested ';
    descriptor += 'property ';

    var hasProperty;
    if (isOwn) hasProperty = Object.prototype.hasOwnProperty.call(obj, name);
    else if (isNested) hasProperty = pathInfo.exists;
    else hasProperty = _.hasProperty(obj, name);

    // When performing a negated assertion for both name and val, merely having
    // a property with the given name isn't enough to cause the assertion to
    // fail. It must both have a property with the given name, and the value of
    // that property must equal the given val. Therefore, skip this assertion in
    // favor of the next.
    if (!negate || arguments.length === 1) {
      this.assert(
          hasProperty
        , 'expected #{this} to have ' + descriptor + _.inspect(name)
        , 'expected #{this} to not have ' + descriptor + _.inspect(name));
    }

    if (arguments.length > 1) {
      this.assert(
          hasProperty && (isDeep ? _.eql(val, value) : val === value)
        , 'expected #{this} to have ' + descriptor + _.inspect(name) + ' of #{exp}, but got #{act}'
        , 'expected #{this} to not have ' + descriptor + _.inspect(name) + ' of #{act}'
        , val
        , value
      );
    }

    flag(this, 'object', value);
  }

  Assertion.addMethod('property', assertProperty);

  function assertOwnProperty (name, value, msg) {
    flag(this, 'own', true);
    assertProperty.apply(this, arguments);
  }

  Assertion.addMethod('ownProperty', assertOwnProperty);
  Assertion.addMethod('haveOwnProperty', assertOwnProperty);

  /**
   * ### .ownPropertyDescriptor(name[, descriptor[, msg]])
   *
   * Asserts that the target has its own property descriptor with the given key
   * `name`. Enumerable and non-enumerable properties are included in the
   * search.
   *
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a');
   *
   * When `descriptor` is provided, `.ownPropertyDescriptor` also asserts that
   * the property's descriptor is deeply equal to the given `descriptor`. See
   * the `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 1,
   *     });
   *
   * Add `.not` earlier in the chain to negate `.ownPropertyDescriptor`.
   *
   *     expect({a: 1}).to.not.have.ownPropertyDescriptor('b');
   *
   * However, it's dangerous to negate `.ownPropertyDescriptor` when providing
   * a `descriptor`. The problem is that it creates uncertain expectations by
   * asserting that the target either doesn't have a property descriptor with
   * the given key `name`, or that it does have a property descriptor with the
   * given key `name` but its not deeply equal to the given `descriptor`. It's
   * often best to identify the exact output that's expected, and then write an
   * assertion that only accepts that exact output.
   *
   * When the target isn't expected to have a property descriptor with the given
   * key `name`, it's often best to assert exactly that.
   *
   *     // Recommended
   *     expect({b: 2}).to.not.have.ownPropertyDescriptor('a');
   *
   *     // Not recommended
   *     expect({b: 2}).to.not.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 1,
   *     });
   *
   * When the target is expected to have a property descriptor with the given
   * key `name`, it's often best to assert that the property has its expected
   * descriptor, rather than asserting that it doesn't have one of many
   * unexpected descriptors.
   *
   *     // Recommended
   *     expect({a: 3}).to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 3,
   *     });
   *
   *     // Not recommended
   *     expect({a: 3}).to.not.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 1,
   *     });
   *
   * `.ownPropertyDescriptor` changes the target of any assertions that follow
   * in the chain to be the value of the property descriptor from the original
   * target object.
   *
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a')
   *       .that.has.property('enumerable', true);
   *
   * `.ownPropertyDescriptor` accepts an optional `msg` argument which is a
   * custom error message to show when the assertion fails. The message can also
   * be given as the second argument to `expect`. When not providing
   * `descriptor`, only use the second form.
   *
   *     // Recommended
   *     expect({a: 1}).to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 2,
   *     }, 'nooo why fail??');
   *
   *     // Recommended
   *     expect({a: 1}, 'nooo why fail??').to.have.ownPropertyDescriptor('a', {
   *       configurable: true,
   *       enumerable: true,
   *       writable: true,
   *       value: 2,
   *     });
   *
   *     // Recommended
   *     expect({a: 1}, 'nooo why fail??').to.have.ownPropertyDescriptor('b');
   *
   *     // Not recommended
   *     expect({a: 1})
   *       .to.have.ownPropertyDescriptor('b', undefined, 'nooo why fail??');
   *
   * The above assertion isn't the same thing as not providing `descriptor`.
   * Instead, it's asserting that the target object has a `b` property
   * descriptor that's deeply equal to `undefined`.
   *
   * The alias `.haveOwnPropertyDescriptor` can be used interchangeably with
   * `.ownPropertyDescriptor`.
   *
   * @name ownPropertyDescriptor
   * @alias haveOwnPropertyDescriptor
   * @param {String} name
   * @param {Object} descriptor _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertOwnPropertyDescriptor (name, descriptor, msg) {
    if (typeof descriptor === 'string') {
      msg = descriptor;
      descriptor = null;
    }
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    var actualDescriptor = Object.getOwnPropertyDescriptor(Object(obj), name);
    if (actualDescriptor && descriptor) {
      this.assert(
          _.eql(descriptor, actualDescriptor)
        , 'expected the own property descriptor for ' + _.inspect(name) + ' on #{this} to match ' + _.inspect(descriptor) + ', got ' + _.inspect(actualDescriptor)
        , 'expected the own property descriptor for ' + _.inspect(name) + ' on #{this} to not match ' + _.inspect(descriptor)
        , descriptor
        , actualDescriptor
        , true
      );
    } else {
      this.assert(
          actualDescriptor
        , 'expected #{this} to have an own property descriptor for ' + _.inspect(name)
        , 'expected #{this} to not have an own property descriptor for ' + _.inspect(name)
      );
    }
    flag(this, 'object', actualDescriptor);
  }

  Assertion.addMethod('ownPropertyDescriptor', assertOwnPropertyDescriptor);
  Assertion.addMethod('haveOwnPropertyDescriptor', assertOwnPropertyDescriptor);

  /**
   * ### .lengthOf(n[, msg])
   *
   * Asserts that the target's `length` or `size` is equal to the given number
   * `n`.
   *
   *     expect([1, 2, 3]).to.have.lengthOf(3);
   *     expect('foo').to.have.lengthOf(3);
   *     expect(new Set([1, 2, 3])).to.have.lengthOf(3);
   *     expect(new Map([['a', 1], ['b', 2], ['c', 3]])).to.have.lengthOf(3);
   *
   * Add `.not` earlier in the chain to negate `.lengthOf`. However, it's often
   * best to assert that the target's `length` property is equal to its expected
   * value, rather than not equal to one of many unexpected values.
   *
   *     expect('foo').to.have.lengthOf(3); // Recommended
   *     expect('foo').to.not.have.lengthOf(4); // Not recommended
   *
   * `.lengthOf` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect([1, 2, 3]).to.have.lengthOf(2, 'nooo why fail??');
   *     expect([1, 2, 3], 'nooo why fail??').to.have.lengthOf(2);
   *
   * `.lengthOf` can also be used as a language chain, causing all `.above`,
   * `.below`, `.least`, `.most`, and `.within` assertions that follow in the
   * chain to use the target's `length` property as the target. However, it's
   * often best to assert that the target's `length` property is equal to its
   * expected length, rather than asserting that its `length` property falls
   * within some range of values.
   *
   *     // Recommended
   *     expect([1, 2, 3]).to.have.lengthOf(3);
   *
   *     // Not recommended
   *     expect([1, 2, 3]).to.have.lengthOf.above(2);
   *     expect([1, 2, 3]).to.have.lengthOf.below(4);
   *     expect([1, 2, 3]).to.have.lengthOf.at.least(3);
   *     expect([1, 2, 3]).to.have.lengthOf.at.most(3);
   *     expect([1, 2, 3]).to.have.lengthOf.within(2,4);
   *
   * Due to a compatibility issue, the alias `.length` can't be chained directly
   * off of an uninvoked method such as `.a`. Therefore, `.length` can't be used
   * interchangeably with `.lengthOf` in every situation. It's recommended to
   * always use `.lengthOf` instead of `.length`.
   *
   *     expect([1, 2, 3]).to.have.a.length(3); // incompatible; throws error
   *     expect([1, 2, 3]).to.have.a.lengthOf(3);  // passes as expected
   *
   * @name lengthOf
   * @alias length
   * @param {Number} n
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertLengthChain () {
    flag(this, 'doLength', true);
  }

  function assertLength (n, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , objType = _.type(obj).toLowerCase()
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi')
      , descriptor = 'length'
      , itemsCount;

    switch (objType) {
      case 'map':
      case 'set':
        descriptor = 'size';
        itemsCount = obj.size;
        break;
      default:
        new Assertion(obj, flagMsg, ssfi, true).to.have.property('length');
        itemsCount = obj.length;
    }

    this.assert(
        itemsCount == n
      , 'expected #{this} to have a ' + descriptor + ' of #{exp} but got #{act}'
      , 'expected #{this} to not have a ' + descriptor + ' of #{act}'
      , n
      , itemsCount
    );
  }

  Assertion.addChainableMethod('length', assertLength, assertLengthChain);
  Assertion.addChainableMethod('lengthOf', assertLength, assertLengthChain);

  /**
   * ### .match(re[, msg])
   *
   * Asserts that the target matches the given regular expression `re`.
   *
   *     expect('foobar').to.match(/^foo/);
   *
   * Add `.not` earlier in the chain to negate `.match`.
   *
   *     expect('foobar').to.not.match(/taco/);
   *
   * `.match` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect('foobar').to.match(/taco/, 'nooo why fail??');
   *     expect('foobar', 'nooo why fail??').to.match(/taco/);
   *
   * The alias `.matches` can be used interchangeably with `.match`.
   *
   * @name match
   * @alias matches
   * @param {RegExp} re
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */
  function assertMatch(re, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    this.assert(
        re.exec(obj)
      , 'expected #{this} to match ' + re
      , 'expected #{this} not to match ' + re
    );
  }

  Assertion.addMethod('match', assertMatch);
  Assertion.addMethod('matches', assertMatch);

  /**
   * ### .string(str[, msg])
   *
   * Asserts that the target string contains the given substring `str`.
   *
   *     expect('foobar').to.have.string('bar');
   *
   * Add `.not` earlier in the chain to negate `.string`.
   *
   *     expect('foobar').to.not.have.string('taco');
   *
   * `.string` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect('foobar').to.have.string('taco', 'nooo why fail??');
   *     expect('foobar', 'nooo why fail??').to.have.string('taco');
   *
   * @name string
   * @param {String} str
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  Assertion.addMethod('string', function (str, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(obj, flagMsg, ssfi, true).is.a('string');

    this.assert(
        ~obj.indexOf(str)
      , 'expected #{this} to contain ' + _.inspect(str)
      , 'expected #{this} to not contain ' + _.inspect(str)
    );
  });

  /**
   * ### .keys(key1[, key2[, ...]])
   *
   * Asserts that the target object, array, map, or set has the given keys. Only
   * the target's own inherited properties are included in the search.
   *
   * When the target is an object or array, keys can be provided as one or more
   * string arguments, a single array argument, or a single object argument. In
   * the latter case, only the keys in the given object matter; the values are
   * ignored.
   *
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b');
   *     expect(['x', 'y']).to.have.all.keys(0, 1);
   *
   *     expect({a: 1, b: 2}).to.have.all.keys(['a', 'b']);
   *     expect(['x', 'y']).to.have.all.keys([0, 1]);
   *
   *     expect({a: 1, b: 2}).to.have.all.keys({a: 4, b: 5}); // ignore 4 and 5
   *     expect(['x', 'y']).to.have.all.keys({0: 4, 1: 5}); // ignore 4 and 5
   *
   * When the target is a map or set, each key must be provided as a separate
   * argument.
   *
   *     expect(new Map([['a', 1], ['b', 2]])).to.have.all.keys('a', 'b');
   *     expect(new Set(['a', 'b'])).to.have.all.keys('a', 'b');
   *
   * Because `.keys` does different things based on the target's type, it's
   * important to check the target's type before using `.keys`. See the `.a` doc
   * for info on testing a target's type.
   *
   *     expect({a: 1, b: 2}).to.be.an('object').that.has.all.keys('a', 'b');
   *
   * By default, strict (`===`) equality is used to compare keys of maps and
   * sets. Add `.deep` earlier in the chain to use deep equality instead. See
   * the `deep-eql` project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target set deeply (but not strictly) has key `{a: 1}`
   *     expect(new Set([{a: 1}])).to.have.all.deep.keys([{a: 1}]);
   *     expect(new Set([{a: 1}])).to.not.have.all.keys([{a: 1}]);
   *
   * By default, the target must have all of the given keys and no more. Add
   * `.any` earlier in the chain to only require that the target have at least
   * one of the given keys. Also, add `.not` earlier in the chain to negate
   * `.keys`. It's often best to add `.any` when negating `.keys`, and to use
   * `.all` when asserting `.keys` without negation.
   *
   * When negating `.keys`, `.any` is preferred because `.not.any.keys` asserts
   * exactly what's expected of the output, whereas `.not.all.keys` creates
   * uncertain expectations.
   *
   *     // Recommended; asserts that target doesn't have any of the given keys
   *     expect({a: 1, b: 2}).to.not.have.any.keys('c', 'd');
   *
   *     // Not recommended; asserts that target doesn't have all of the given
   *     // keys but may or may not have some of them
   *     expect({a: 1, b: 2}).to.not.have.all.keys('c', 'd');
   *
   * When asserting `.keys` without negation, `.all` is preferred because
   * `.all.keys` asserts exactly what's expected of the output, whereas
   * `.any.keys` creates uncertain expectations.
   *
   *     // Recommended; asserts that target has all the given keys
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b');
   *
   *     // Not recommended; asserts that target has at least one of the given
   *     // keys but may or may not have more of them
   *     expect({a: 1, b: 2}).to.have.any.keys('a', 'b');
   *
   * Note that `.all` is used by default when neither `.all` nor `.any` appear
   * earlier in the chain. However, it's often best to add `.all` anyway because
   * it improves readability.
   *
   *     // Both assertions are identical
   *     expect({a: 1, b: 2}).to.have.all.keys('a', 'b'); // Recommended
   *     expect({a: 1, b: 2}).to.have.keys('a', 'b'); // Not recommended
   *
   * Add `.include` earlier in the chain to require that the target's keys be a
   * superset of the expected keys, rather than identical sets.
   *
   *     // Target object's keys are a superset of ['a', 'b'] but not identical
   *     expect({a: 1, b: 2, c: 3}).to.include.all.keys('a', 'b');
   *     expect({a: 1, b: 2, c: 3}).to.not.have.all.keys('a', 'b');
   *
   * However, if `.any` and `.include` are combined, only the `.any` takes
   * effect. The `.include` is ignored in this case.
   *
   *     // Both assertions are identical
   *     expect({a: 1}).to.have.any.keys('a', 'b');
   *     expect({a: 1}).to.include.any.keys('a', 'b');
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({a: 1}, 'nooo why fail??').to.have.key('b');
   *
   * The alias `.key` can be used interchangeably with `.keys`.
   *
   * @name keys
   * @alias key
   * @param {...String|Array|Object} keys
   * @namespace BDD
   * @api public
   */

  function assertKeys (keys) {
    var obj = flag(this, 'object')
      , objType = _.type(obj)
      , keysType = _.type(keys)
      , ssfi = flag(this, 'ssfi')
      , isDeep = flag(this, 'deep')
      , str
      , deepStr = ''
      , actual
      , ok = true
      , flagMsg = flag(this, 'message');

    flagMsg = flagMsg ? flagMsg + ': ' : '';
    var mixedArgsMsg = flagMsg + 'when testing keys against an object or an array you must give a single Array|Object|String argument or multiple String arguments';

    if (objType === 'Map' || objType === 'Set') {
      deepStr = isDeep ? 'deeply ' : '';
      actual = [];

      // Map and Set '.keys' aren't supported in IE 11. Therefore, use .forEach.
      obj.forEach(function (val, key) { actual.push(key) });

      if (keysType !== 'Array') {
        keys = Array.prototype.slice.call(arguments);
      }
    } else {
      actual = _.getOwnEnumerableProperties(obj);

      switch (keysType) {
        case 'Array':
          if (arguments.length > 1) {
            throw new AssertionError(mixedArgsMsg, undefined, ssfi);
          }
          break;
        case 'Object':
          if (arguments.length > 1) {
            throw new AssertionError(mixedArgsMsg, undefined, ssfi);
          }
          keys = Object.keys(keys);
          break;
        default:
          keys = Array.prototype.slice.call(arguments);
      }

      // Only stringify non-Symbols because Symbols would become "Symbol()"
      keys = keys.map(function (val) {
        return typeof val === 'symbol' ? val : String(val);
      });
    }

    if (!keys.length) {
      throw new AssertionError(flagMsg + 'keys required', undefined, ssfi);
    }

    var len = keys.length
      , any = flag(this, 'any')
      , all = flag(this, 'all')
      , expected = keys;

    if (!any && !all) {
      all = true;
    }

    // Has any
    if (any) {
      ok = expected.some(function(expectedKey) {
        return actual.some(function(actualKey) {
          if (isDeep) {
            return _.eql(expectedKey, actualKey);
          } else {
            return expectedKey === actualKey;
          }
        });
      });
    }

    // Has all
    if (all) {
      ok = expected.every(function(expectedKey) {
        return actual.some(function(actualKey) {
          if (isDeep) {
            return _.eql(expectedKey, actualKey);
          } else {
            return expectedKey === actualKey;
          }
        });
      });

      if (!flag(this, 'contains')) {
        ok = ok && keys.length == actual.length;
      }
    }

    // Key string
    if (len > 1) {
      keys = keys.map(function(key) {
        return _.inspect(key);
      });
      var last = keys.pop();
      if (all) {
        str = keys.join(', ') + ', and ' + last;
      }
      if (any) {
        str = keys.join(', ') + ', or ' + last;
      }
    } else {
      str = _.inspect(keys[0]);
    }

    // Form
    str = (len > 1 ? 'keys ' : 'key ') + str;

    // Have / include
    str = (flag(this, 'contains') ? 'contain ' : 'have ') + str;

    // Assertion
    this.assert(
        ok
      , 'expected #{this} to ' + deepStr + str
      , 'expected #{this} to not ' + deepStr + str
      , expected.slice(0).sort(_.compareByInspect)
      , actual.sort(_.compareByInspect)
      , true
    );
  }

  Assertion.addMethod('keys', assertKeys);
  Assertion.addMethod('key', assertKeys);

  /**
   * ### .throw([errorLike], [errMsgMatcher], [msg])
   *
   * When no arguments are provided, `.throw` invokes the target function and
   * asserts that an error is thrown.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw();
   *
   * When one argument is provided, and it's an error constructor, `.throw`
   * invokes the target function and asserts that an error is thrown that's an
   * instance of that error constructor.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw(TypeError);
   *
   * When one argument is provided, and it's an error instance, `.throw` invokes
   * the target function and asserts that an error is thrown that's strictly
   * (`===`) equal to that error instance.
   *
   *     var err = new TypeError('Illegal salmon!');
   *     var badFn = function () { throw err; };
   *
   *     expect(badFn).to.throw(err);
   *
   * When one argument is provided, and it's a string, `.throw` invokes the
   * target function and asserts that an error is thrown with a message that
   * contains that string.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw('salmon');
   *
   * When one argument is provided, and it's a regular expression, `.throw`
   * invokes the target function and asserts that an error is thrown with a
   * message that matches that regular expression.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw(/salmon/);
   *
   * When two arguments are provided, and the first is an error instance or
   * constructor, and the second is a string or regular expression, `.throw`
   * invokes the function and asserts that an error is thrown that fulfills both
   * conditions as described above.
   *
   *     var err = new TypeError('Illegal salmon!');
   *     var badFn = function () { throw err; };
   *
   *     expect(badFn).to.throw(TypeError, 'salmon');
   *     expect(badFn).to.throw(TypeError, /salmon/);
   *     expect(badFn).to.throw(err, 'salmon');
   *     expect(badFn).to.throw(err, /salmon/);
   *
   * Add `.not` earlier in the chain to negate `.throw`.
   *
   *     var goodFn = function () {};
   *
   *     expect(goodFn).to.not.throw();
   *
   * However, it's dangerous to negate `.throw` when providing any arguments.
   * The problem is that it creates uncertain expectations by asserting that the
   * target either doesn't throw an error, or that it throws an error but of a
   * different type than the given type, or that it throws an error of the given
   * type but with a message that doesn't include the given string. It's often
   * best to identify the exact output that's expected, and then write an
   * assertion that only accepts that exact output.
   *
   * When the target isn't expected to throw an error, it's often best to assert
   * exactly that.
   *
   *     var goodFn = function () {};
   *
   *     expect(goodFn).to.not.throw(); // Recommended
   *     expect(goodFn).to.not.throw(ReferenceError, 'x'); // Not recommended
   *
   * When the target is expected to throw an error, it's often best to assert
   * that the error is of its expected type, and has a message that includes an
   * expected string, rather than asserting that it doesn't have one of many
   * unexpected types, and doesn't have a message that includes some string.
   *
   *     var badFn = function () { throw new TypeError('Illegal salmon!'); };
   *
   *     expect(badFn).to.throw(TypeError, 'salmon'); // Recommended
   *     expect(badFn).to.not.throw(ReferenceError, 'x'); // Not recommended
   *
   * `.throw` changes the target of any assertions that follow in the chain to
   * be the error object that's thrown.
   *
   *     var err = new TypeError('Illegal salmon!');
   *     err.code = 42;
   *     var badFn = function () { throw err; };
   *
   *     expect(badFn).to.throw(TypeError).with.property('code', 42);
   *
   * `.throw` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`. When not providing two arguments, always use
   * the second form.
   *
   *     var goodFn = function () {};
   *
   *     expect(goodFn).to.throw(TypeError, 'x', 'nooo why fail??');
   *     expect(goodFn, 'nooo why fail??').to.throw();
   *
   * Due to limitations in ES5, `.throw` may not always work as expected when
   * using a transpiler such as Babel or TypeScript. In particular, it may
   * produce unexpected results when subclassing the built-in `Error` object and
   * then passing the subclassed constructor to `.throw`. See your transpiler's
   * docs for details:
   *
   * - ([Babel](https://babeljs.io/docs/usage/caveats/#classes))
   * - ([TypeScript](https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work))
   *
   * Beware of some common mistakes when using the `throw` assertion. One common
   * mistake is to accidentally invoke the function yourself instead of letting
   * the `throw` assertion invoke the function for you. For example, when
   * testing if a function named `fn` throws, provide `fn` instead of `fn()` as
   * the target for the assertion.
   *
   *     expect(fn).to.throw();     // Good! Tests `fn` as desired
   *     expect(fn()).to.throw();   // Bad! Tests result of `fn()`, not `fn`
   *
   * If you need to assert that your function `fn` throws when passed certain
   * arguments, then wrap a call to `fn` inside of another function.
   *
   *     expect(function () { fn(42); }).to.throw();  // Function expression
   *     expect(() => fn(42)).to.throw();             // ES6 arrow function
   *
   * Another common mistake is to provide an object method (or any stand-alone
   * function that relies on `this`) as the target of the assertion. Doing so is
   * problematic because the `this` context will be lost when the function is
   * invoked by `.throw`; there's no way for it to know what `this` is supposed
   * to be. There are two ways around this problem. One solution is to wrap the
   * method or function call inside of another function. Another solution is to
   * use `bind`.
   *
   *     expect(function () { cat.meow(); }).to.throw();  // Function expression
   *     expect(() => cat.meow()).to.throw();             // ES6 arrow function
   *     expect(cat.meow.bind(cat)).to.throw();           // Bind
   *
   * Finally, it's worth mentioning that it's a best practice in JavaScript to
   * only throw `Error` and derivatives of `Error` such as `ReferenceError`,
   * `TypeError`, and user-defined objects that extend `Error`. No other type of
   * value will generate a stack trace when initialized. With that said, the
   * `throw` assertion does technically support any type of value being thrown,
   * not just `Error` and its derivatives.
   *
   * The aliases `.throws` and `.Throw` can be used interchangeably with
   * `.throw`.
   *
   * @name throw
   * @alias throws
   * @alias Throw
   * @param {Error|ErrorConstructor} errorLike
   * @param {String|RegExp} errMsgMatcher error message
   * @param {String} msg _optional_
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @returns error for chaining (null if no error)
   * @namespace BDD
   * @api public
   */

  function assertThrows (errorLike, errMsgMatcher, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , ssfi = flag(this, 'ssfi')
      , flagMsg = flag(this, 'message')
      , negate = flag(this, 'negate') || false;
    new Assertion(obj, flagMsg, ssfi, true).is.a('function');

    if (errorLike instanceof RegExp || typeof errorLike === 'string') {
      errMsgMatcher = errorLike;
      errorLike = null;
    }

    var caughtErr;
    try {
      obj();
    } catch (err) {
      caughtErr = err;
    }

    // If we have the negate flag enabled and at least one valid argument it means we do expect an error
    // but we want it to match a given set of criteria
    var everyArgIsUndefined = errorLike === undefined && errMsgMatcher === undefined;

    // If we've got the negate flag enabled and both args, we should only fail if both aren't compatible
    // See Issue #551 and PR #683@GitHub
    var everyArgIsDefined = Boolean(errorLike && errMsgMatcher);
    var errorLikeFail = false;
    var errMsgMatcherFail = false;

    // Checking if error was thrown
    if (everyArgIsUndefined || !everyArgIsUndefined && !negate) {
      // We need this to display results correctly according to their types
      var errorLikeString = 'an error';
      if (errorLike instanceof Error) {
        errorLikeString = '#{exp}';
      } else if (errorLike) {
        errorLikeString = _.checkError.getConstructorName(errorLike);
      }

      this.assert(
          caughtErr
        , 'expected #{this} to throw ' + errorLikeString
        , 'expected #{this} to not throw an error but #{act} was thrown'
        , errorLike && errorLike.toString()
        , (caughtErr instanceof Error ?
            caughtErr.toString() : (typeof caughtErr === 'string' ? caughtErr : caughtErr &&
                                    _.checkError.getConstructorName(caughtErr)))
      );
    }

    if (errorLike && caughtErr) {
      // We should compare instances only if `errorLike` is an instance of `Error`
      if (errorLike instanceof Error) {
        var isCompatibleInstance = _.checkError.compatibleInstance(caughtErr, errorLike);

        if (isCompatibleInstance === negate) {
          // These checks were created to ensure we won't fail too soon when we've got both args and a negate
          // See Issue #551 and PR #683@GitHub
          if (everyArgIsDefined && negate) {
            errorLikeFail = true;
          } else {
            this.assert(
                negate
              , 'expected #{this} to throw #{exp} but #{act} was thrown'
              , 'expected #{this} to not throw #{exp}' + (caughtErr && !negate ? ' but #{act} was thrown' : '')
              , errorLike.toString()
              , caughtErr.toString()
            );
          }
        }
      }

      var isCompatibleConstructor = _.checkError.compatibleConstructor(caughtErr, errorLike);
      if (isCompatibleConstructor === negate) {
        if (everyArgIsDefined && negate) {
            errorLikeFail = true;
        } else {
          this.assert(
              negate
            , 'expected #{this} to throw #{exp} but #{act} was thrown'
            , 'expected #{this} to not throw #{exp}' + (caughtErr ? ' but #{act} was thrown' : '')
            , (errorLike instanceof Error ? errorLike.toString() : errorLike && _.checkError.getConstructorName(errorLike))
            , (caughtErr instanceof Error ? caughtErr.toString() : caughtErr && _.checkError.getConstructorName(caughtErr))
          );
        }
      }
    }

    if (caughtErr && errMsgMatcher !== undefined && errMsgMatcher !== null) {
      // Here we check compatible messages
      var placeholder = 'including';
      if (errMsgMatcher instanceof RegExp) {
        placeholder = 'matching'
      }

      var isCompatibleMessage = _.checkError.compatibleMessage(caughtErr, errMsgMatcher);
      if (isCompatibleMessage === negate) {
        if (everyArgIsDefined && negate) {
            errMsgMatcherFail = true;
        } else {
          this.assert(
            negate
            , 'expected #{this} to throw error ' + placeholder + ' #{exp} but got #{act}'
            , 'expected #{this} to throw error not ' + placeholder + ' #{exp}'
            ,  errMsgMatcher
            ,  _.checkError.getMessage(caughtErr)
          );
        }
      }
    }

    // If both assertions failed and both should've matched we throw an error
    if (errorLikeFail && errMsgMatcherFail) {
      this.assert(
        negate
        , 'expected #{this} to throw #{exp} but #{act} was thrown'
        , 'expected #{this} to not throw #{exp}' + (caughtErr ? ' but #{act} was thrown' : '')
        , (errorLike instanceof Error ? errorLike.toString() : errorLike && _.checkError.getConstructorName(errorLike))
        , (caughtErr instanceof Error ? caughtErr.toString() : caughtErr && _.checkError.getConstructorName(caughtErr))
      );
    }

    flag(this, 'object', caughtErr);
  };

  Assertion.addMethod('throw', assertThrows);
  Assertion.addMethod('throws', assertThrows);
  Assertion.addMethod('Throw', assertThrows);

  /**
   * ### .respondTo(method[, msg])
   *
   * When the target is a non-function object, `.respondTo` asserts that the
   * target has a method with the given name `method`. The method can be own or
   * inherited, and it can be enumerable or non-enumerable.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *
   *     expect(new Cat()).to.respondTo('meow');
   *
   * When the target is a function, `.respondTo` asserts that the target's
   * `prototype` property has a method with the given name `method`. Again, the
   * method can be own or inherited, and it can be enumerable or non-enumerable.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *
   *     expect(Cat).to.respondTo('meow');
   *
   * Add `.itself` earlier in the chain to force `.respondTo` to treat the
   * target as a non-function object, even if it's a function. Thus, it asserts
   * that the target has a method with the given name `method`, rather than
   * asserting that the target's `prototype` property has a method with the
   * given name `method`.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *     Cat.hiss = function () {};
   *
   *     expect(Cat).itself.to.respondTo('hiss').but.not.respondTo('meow');
   *
   * When not adding `.itself`, it's important to check the target's type before
   * using `.respondTo`. See the `.a` doc for info on checking a target's type.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *
   *     expect(new Cat()).to.be.an('object').that.respondsTo('meow');
   *
   * Add `.not` earlier in the chain to negate `.respondTo`.
   *
   *     function Dog () {}
   *     Dog.prototype.bark = function () {};
   *
   *     expect(new Dog()).to.not.respondTo('meow');
   *
   * `.respondTo` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect({}).to.respondTo('meow', 'nooo why fail??');
   *     expect({}, 'nooo why fail??').to.respondTo('meow');
   *
   * The alias `.respondsTo` can be used interchangeably with `.respondTo`.
   *
   * @name respondTo
   * @alias respondsTo
   * @param {String} method
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function respondTo (method, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , itself = flag(this, 'itself')
      , context = ('function' === typeof obj && !itself)
        ? obj.prototype[method]
        : obj[method];

    this.assert(
        'function' === typeof context
      , 'expected #{this} to respond to ' + _.inspect(method)
      , 'expected #{this} to not respond to ' + _.inspect(method)
    );
  }

  Assertion.addMethod('respondTo', respondTo);
  Assertion.addMethod('respondsTo', respondTo);

  /**
   * ### .itself
   *
   * Forces all `.respondTo` assertions that follow in the chain to behave as if
   * the target is a non-function object, even if it's a function. Thus, it
   * causes `.respondTo` to assert that the target has a method with the given
   * name, rather than asserting that the target's `prototype` property has a
   * method with the given name.
   *
   *     function Cat () {}
   *     Cat.prototype.meow = function () {};
   *     Cat.hiss = function () {};
   *
   *     expect(Cat).itself.to.respondTo('hiss').but.not.respondTo('meow');
   *
   * @name itself
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('itself', function () {
    flag(this, 'itself', true);
  });

  /**
   * ### .satisfy(matcher[, msg])
   *
   * Invokes the given `matcher` function with the target being passed as the
   * first argument, and asserts that the value returned is truthy.
   *
   *     expect(1).to.satisfy(function(num) {
   *       return num > 0;
   *     });
   *
   * Add `.not` earlier in the chain to negate `.satisfy`.
   *
   *     expect(1).to.not.satisfy(function(num) {
   *       return num > 2;
   *     });
   *
   * `.satisfy` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(1).to.satisfy(function(num) {
   *       return num > 2;
   *     }, 'nooo why fail??');
   *
   *     expect(1, 'nooo why fail??').to.satisfy(function(num) {
   *       return num > 2;
   *     });
   *
   * The alias `.satisfies` can be used interchangeably with `.satisfy`.
   *
   * @name satisfy
   * @alias satisfies
   * @param {Function} matcher
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function satisfy (matcher, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object');
    var result = matcher(obj);
    this.assert(
        result
      , 'expected #{this} to satisfy ' + _.objDisplay(matcher)
      , 'expected #{this} to not satisfy' + _.objDisplay(matcher)
      , flag(this, 'negate') ? false : true
      , result
    );
  }

  Assertion.addMethod('satisfy', satisfy);
  Assertion.addMethod('satisfies', satisfy);

  /**
   * ### .closeTo(expected, delta[, msg])
   *
   * Asserts that the target is a number that's within a given +/- `delta` range
   * of the given number `expected`. However, it's often best to assert that the
   * target is equal to its expected value.
   *
   *     // Recommended
   *     expect(1.5).to.equal(1.5);
   *
   *     // Not recommended
   *     expect(1.5).to.be.closeTo(1, 0.5);
   *     expect(1.5).to.be.closeTo(2, 0.5);
   *     expect(1.5).to.be.closeTo(1, 1);
   *
   * Add `.not` earlier in the chain to negate `.closeTo`.
   *
   *     expect(1.5).to.equal(1.5); // Recommended
   *     expect(1.5).to.not.be.closeTo(3, 1); // Not recommended
   *
   * `.closeTo` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect(1.5).to.be.closeTo(3, 1, 'nooo why fail??');
   *     expect(1.5, 'nooo why fail??').to.be.closeTo(3, 1);
   *
   * The alias `.approximately` can be used interchangeably with `.closeTo`.
   *
   * @name closeTo
   * @alias approximately
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function closeTo(expected, delta, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');

    new Assertion(obj, flagMsg, ssfi, true).is.a('number');
    if (typeof expected !== 'number' || typeof delta !== 'number') {
      flagMsg = flagMsg ? flagMsg + ': ' : '';
      throw new AssertionError(
          flagMsg + 'the arguments to closeTo or approximately must be numbers',
          undefined,
          ssfi
      );
    }

    this.assert(
        Math.abs(obj - expected) <= delta
      , 'expected #{this} to be close to ' + expected + ' +/- ' + delta
      , 'expected #{this} not to be close to ' + expected + ' +/- ' + delta
    );
  }

  Assertion.addMethod('closeTo', closeTo);
  Assertion.addMethod('approximately', closeTo);

  // Note: Duplicates are ignored if testing for inclusion instead of sameness.
  function isSubsetOf(subset, superset, cmp, contains, ordered) {
    if (!contains) {
      if (subset.length !== superset.length) return false;
      superset = superset.slice();
    }

    return subset.every(function(elem, idx) {
      if (ordered) return cmp ? cmp(elem, superset[idx]) : elem === superset[idx];

      if (!cmp) {
        var matchIdx = superset.indexOf(elem);
        if (matchIdx === -1) return false;

        // Remove match from superset so not counted twice if duplicate in subset.
        if (!contains) superset.splice(matchIdx, 1);
        return true;
      }

      return superset.some(function(elem2, matchIdx) {
        if (!cmp(elem, elem2)) return false;

        // Remove match from superset so not counted twice if duplicate in subset.
        if (!contains) superset.splice(matchIdx, 1);
        return true;
      });
    });
  }

  /**
   * ### .members(set[, msg])
   *
   * Asserts that the target array has the same members as the given array
   * `set`.
   *
   *     expect([1, 2, 3]).to.have.members([2, 1, 3]);
   *     expect([1, 2, 2]).to.have.members([2, 1, 2]);
   *
   * By default, members are compared using strict (`===`) equality. Add `.deep`
   * earlier in the chain to use deep equality instead. See the `deep-eql`
   * project page for info on the deep equality algorithm:
   * https://github.com/chaijs/deep-eql.
   *
   *     // Target array deeply (but not strictly) has member `{a: 1}`
   *     expect([{a: 1}]).to.have.deep.members([{a: 1}]);
   *     expect([{a: 1}]).to.not.have.members([{a: 1}]);
   *
   * By default, order doesn't matter. Add `.ordered` earlier in the chain to
   * require that members appear in the same order.
   *
   *     expect([1, 2, 3]).to.have.ordered.members([1, 2, 3]);
   *     expect([1, 2, 3]).to.have.members([2, 1, 3])
   *       .but.not.ordered.members([2, 1, 3]);
   *
   * By default, both arrays must be the same size. Add `.include` earlier in
   * the chain to require that the target's members be a superset of the
   * expected members. Note that duplicates are ignored in the subset when
   * `.include` is added.
   *
   *     // Target array is a superset of [1, 2] but not identical
   *     expect([1, 2, 3]).to.include.members([1, 2]);
   *     expect([1, 2, 3]).to.not.have.members([1, 2]);
   *
   *     // Duplicates in the subset are ignored
   *     expect([1, 2, 3]).to.include.members([1, 2, 2, 2]);
   *
   * `.deep`, `.ordered`, and `.include` can all be combined. However, if
   * `.include` and `.ordered` are combined, the ordering begins at the start of
   * both arrays.
   *
   *     expect([{a: 1}, {b: 2}, {c: 3}])
   *       .to.include.deep.ordered.members([{a: 1}, {b: 2}])
   *       .but.not.include.deep.ordered.members([{b: 2}, {c: 3}]);
   *
   * Add `.not` earlier in the chain to negate `.members`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the target array doesn't have all of the same members as
   * the given array `set` but may or may not have some of them. It's often best
   * to identify the exact output that's expected, and then write an assertion
   * that only accepts that exact output.
   *
   *     expect([1, 2]).to.not.include(3).and.not.include(4); // Recommended
   *     expect([1, 2]).to.not.have.members([3, 4]); // Not recommended
   *
   * `.members` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`.
   *
   *     expect([1, 2]).to.have.members([1, 2, 3], 'nooo why fail??');
   *     expect([1, 2], 'nooo why fail??').to.have.members([1, 2, 3]);
   *
   * @name members
   * @param {Array} set
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  Assertion.addMethod('members', function (subset, msg) {
    if (msg) flag(this, 'message', msg);
    var obj = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');

    new Assertion(obj, flagMsg, ssfi, true).to.be.an('array');
    new Assertion(subset, flagMsg, ssfi, true).to.be.an('array');

    var contains = flag(this, 'contains');
    var ordered = flag(this, 'ordered');

    var subject, failMsg, failNegateMsg;

    if (contains) {
      subject = ordered ? 'an ordered superset' : 'a superset';
      failMsg = 'expected #{this} to be ' + subject + ' of #{exp}';
      failNegateMsg = 'expected #{this} to not be ' + subject + ' of #{exp}';
    } else {
      subject = ordered ? 'ordered members' : 'members';
      failMsg = 'expected #{this} to have the same ' + subject + ' as #{exp}';
      failNegateMsg = 'expected #{this} to not have the same ' + subject + ' as #{exp}';
    }

    var cmp = flag(this, 'deep') ? _.eql : undefined;

    this.assert(
        isSubsetOf(subset, obj, cmp, contains, ordered)
      , failMsg
      , failNegateMsg
      , subset
      , obj
      , true
    );
  });

  /**
   * ### .oneOf(list[, msg])
   *
   * Asserts that the target is a member of the given array `list`. However,
   * it's often best to assert that the target is equal to its expected value.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.be.oneOf([1, 2, 3]); // Not recommended
   *
   * Comparisons are performed using strict (`===`) equality.
   *
   * Add `.not` earlier in the chain to negate `.oneOf`.
   *
   *     expect(1).to.equal(1); // Recommended
   *     expect(1).to.not.be.oneOf([2, 3, 4]); // Not recommended
   *
   * `.oneOf` accepts an optional `msg` argument which is a custom error message
   * to show when the assertion fails. The message can also be given as the
   * second argument to `expect`.
   *
   *     expect(1).to.be.oneOf([2, 3, 4], 'nooo why fail??');
   *     expect(1, 'nooo why fail??').to.be.oneOf([2, 3, 4]);
   *
   * @name oneOf
   * @param {Array<*>} list
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function oneOf (list, msg) {
    if (msg) flag(this, 'message', msg);
    var expected = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(list, flagMsg, ssfi, true).to.be.an('array');

    this.assert(
        list.indexOf(expected) > -1
      , 'expected #{this} to be one of #{exp}'
      , 'expected #{this} to not be one of #{exp}'
      , list
      , expected
    );
  }

  Assertion.addMethod('oneOf', oneOf);

  /**
   * ### .change(subject[, prop[, msg]])
   *
   * When one argument is provided, `.change` asserts that the given function
   * `subject` returns a different value when it's invoked before the target
   * function compared to when it's invoked afterward. However, it's often best
   * to assert that `subject` is equal to its expected value.
   *
   *     var dots = ''
   *       , addDot = function () { dots += '.'; }
   *       , getDots = function () { return dots; };
   *
   *     // Recommended
   *     expect(getDots()).to.equal('');
   *     addDot();
   *     expect(getDots()).to.equal('.');
   *
   *     // Not recommended
   *     expect(addDot).to.change(getDots);
   *
   * When two arguments are provided, `.change` asserts that the value of the
   * given object `subject`'s `prop` property is different before invoking the
   * target function compared to afterward.
   *
   *     var myObj = {dots: ''}
   *       , addDot = function () { myObj.dots += '.'; };
   *
   *     // Recommended
   *     expect(myObj).to.have.property('dots', '');
   *     addDot();
   *     expect(myObj).to.have.property('dots', '.');
   *
   *     // Not recommended
   *     expect(addDot).to.change(myObj, 'dots');
   *
   * Strict (`===`) equality is used to compare before and after values.
   *
   * Add `.not` earlier in the chain to negate `.change`.
   *
   *     var dots = ''
   *       , noop = function () {}
   *       , getDots = function () { return dots; };
   *
   *     expect(noop).to.not.change(getDots);
   *
   *     var myObj = {dots: ''}
   *       , noop = function () {};
   *
   *     expect(noop).to.not.change(myObj, 'dots');
   *
   * `.change` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing two arguments, always
   * use the second form.
   *
   *     var myObj = {dots: ''}
   *       , addDot = function () { myObj.dots += '.'; };
   *
   *     expect(addDot).to.not.change(myObj, 'dots', 'nooo why fail??');
   *
   *     var dots = ''
   *       , addDot = function () { dots += '.'; }
   *       , getDots = function () { return dots; };
   *
   *     expect(addDot, 'nooo why fail??').to.not.change(getDots);
   *
   * `.change` also causes all `.by` assertions that follow in the chain to
   * assert how much a numeric subject was increased or decreased by. However,
   * it's dangerous to use `.change.by`. The problem is that it creates
   * uncertain expectations by asserting that the subject either increases by
   * the given delta, or that it decreases by the given delta. It's often best
   * to identify the exact output that's expected, and then write an assertion
   * that only accepts that exact output.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; }
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   * The alias `.changes` can be used interchangeably with `.change`.
   *
   * @name change
   * @alias changes
   * @param {String} subject
   * @param {String} prop name _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertChanges (subject, prop, msg) {
    if (msg) flag(this, 'message', msg);
    var fn = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(fn, flagMsg, ssfi, true).is.a('function');

    var initial;
    if (!prop) {
      new Assertion(subject, flagMsg, ssfi, true).is.a('function');
      initial = subject();
    } else {
      new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
      initial = subject[prop];
    }

    fn();

    var final = prop === undefined || prop === null ? subject() : subject[prop];
    var msgObj = prop === undefined || prop === null ? initial : '.' + prop;

    // This gets flagged because of the .by(delta) assertion
    flag(this, 'deltaMsgObj', msgObj);
    flag(this, 'initialDeltaValue', initial);
    flag(this, 'finalDeltaValue', final);
    flag(this, 'deltaBehavior', 'change');
    flag(this, 'realDelta', final !== initial);

    this.assert(
      initial !== final
      , 'expected ' + msgObj + ' to change'
      , 'expected ' + msgObj + ' to not change'
    );
  }

  Assertion.addMethod('change', assertChanges);
  Assertion.addMethod('changes', assertChanges);

  /**
   * ### .increase(subject[, prop[, msg]])
   *
   * When one argument is provided, `.increase` asserts that the given function
   * `subject` returns a greater number when it's invoked after invoking the
   * target function compared to when it's invoked beforehand. `.increase` also
   * causes all `.by` assertions that follow in the chain to assert how much
   * greater of a number is returned. It's often best to assert that the return
   * value increased by the expected amount, rather than asserting it increased
   * by any amount.
   *
   *     var val = 1
   *       , addTwo = function () { val += 2; }
   *       , getVal = function () { return val; };
   *
   *     expect(addTwo).to.increase(getVal).by(2); // Recommended
   *     expect(addTwo).to.increase(getVal); // Not recommended
   *
   * When two arguments are provided, `.increase` asserts that the value of the
   * given object `subject`'s `prop` property is greater after invoking the
   * target function compared to beforehand.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.increase(myObj, 'val'); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.increase`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the subject either decreases, or that it stays the same.
   * It's often best to identify the exact output that's expected, and then
   * write an assertion that only accepts that exact output.
   *
   * When the subject is expected to decrease, it's often best to assert that it
   * decreased by the expected amount.
   *
   *     var myObj = {val: 1}
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.not.increase(myObj, 'val'); // Not recommended
   *
   * When the subject is expected to stay the same, it's often best to assert
   * exactly that.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.not.change(myObj, 'val'); // Recommended
   *     expect(noop).to.not.increase(myObj, 'val'); // Not recommended
   *
   * `.increase` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing two arguments, always
   * use the second form.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.increase(myObj, 'val', 'nooo why fail??');
   *
   *     var val = 1
   *       , noop = function () {}
   *       , getVal = function () { return val; };
   *
   *     expect(noop, 'nooo why fail??').to.increase(getVal);
   *
   * The alias `.increases` can be used interchangeably with `.increase`.
   *
   * @name increase
   * @alias increases
   * @param {String|Function} subject
   * @param {String} prop name _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertIncreases (subject, prop, msg) {
    if (msg) flag(this, 'message', msg);
    var fn = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(fn, flagMsg, ssfi, true).is.a('function');

    var initial;
    if (!prop) {
      new Assertion(subject, flagMsg, ssfi, true).is.a('function');
      initial = subject();
    } else {
      new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
      initial = subject[prop];
    }

    // Make sure that the target is a number
    new Assertion(initial, flagMsg, ssfi, true).is.a('number');

    fn();

    var final = prop === undefined || prop === null ? subject() : subject[prop];
    var msgObj = prop === undefined || prop === null ? initial : '.' + prop;

    flag(this, 'deltaMsgObj', msgObj);
    flag(this, 'initialDeltaValue', initial);
    flag(this, 'finalDeltaValue', final);
    flag(this, 'deltaBehavior', 'increase');
    flag(this, 'realDelta', final - initial);

    this.assert(
      final - initial > 0
      , 'expected ' + msgObj + ' to increase'
      , 'expected ' + msgObj + ' to not increase'
    );
  }

  Assertion.addMethod('increase', assertIncreases);
  Assertion.addMethod('increases', assertIncreases);

  /**
   * ### .decrease(subject[, prop[, msg]])
   *
   * When one argument is provided, `.decrease` asserts that the given function
   * `subject` returns a lesser number when it's invoked after invoking the
   * target function compared to when it's invoked beforehand. `.decrease` also
   * causes all `.by` assertions that follow in the chain to assert how much
   * lesser of a number is returned. It's often best to assert that the return
   * value decreased by the expected amount, rather than asserting it decreased
   * by any amount.
   *
   *     var val = 1
   *       , subtractTwo = function () { val -= 2; }
   *       , getVal = function () { return val; };
   *
   *     expect(subtractTwo).to.decrease(getVal).by(2); // Recommended
   *     expect(subtractTwo).to.decrease(getVal); // Not recommended
   *
   * When two arguments are provided, `.decrease` asserts that the value of the
   * given object `subject`'s `prop` property is lesser after invoking the
   * target function compared to beforehand.
   *
   *     var myObj = {val: 1}
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.decrease(myObj, 'val'); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.decrease`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the subject either increases, or that it stays the same.
   * It's often best to identify the exact output that's expected, and then
   * write an assertion that only accepts that exact output.
   *
   * When the subject is expected to increase, it's often best to assert that it
   * increased by the expected amount.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.not.decrease(myObj, 'val'); // Not recommended
   *
   * When the subject is expected to stay the same, it's often best to assert
   * exactly that.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.not.change(myObj, 'val'); // Recommended
   *     expect(noop).to.not.decrease(myObj, 'val'); // Not recommended
   *
   * `.decrease` accepts an optional `msg` argument which is a custom error
   * message to show when the assertion fails. The message can also be given as
   * the second argument to `expect`. When not providing two arguments, always
   * use the second form.
   *
   *     var myObj = {val: 1}
   *       , noop = function () {};
   *
   *     expect(noop).to.decrease(myObj, 'val', 'nooo why fail??');
   *
   *     var val = 1
   *       , noop = function () {}
   *       , getVal = function () { return val; };
   *
   *     expect(noop, 'nooo why fail??').to.decrease(getVal);
   *
   * The alias `.decreases` can be used interchangeably with `.decrease`.
   *
   * @name decrease
   * @alias decreases
   * @param {String|Function} subject
   * @param {String} prop name _optional_
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertDecreases (subject, prop, msg) {
    if (msg) flag(this, 'message', msg);
    var fn = flag(this, 'object')
      , flagMsg = flag(this, 'message')
      , ssfi = flag(this, 'ssfi');
    new Assertion(fn, flagMsg, ssfi, true).is.a('function');

    var initial;
    if (!prop) {
      new Assertion(subject, flagMsg, ssfi, true).is.a('function');
      initial = subject();
    } else {
      new Assertion(subject, flagMsg, ssfi, true).to.have.property(prop);
      initial = subject[prop];
    }

    // Make sure that the target is a number
    new Assertion(initial, flagMsg, ssfi, true).is.a('number');

    fn();

    var final = prop === undefined || prop === null ? subject() : subject[prop];
    var msgObj = prop === undefined || prop === null ? initial : '.' + prop;

    flag(this, 'deltaMsgObj', msgObj);
    flag(this, 'initialDeltaValue', initial);
    flag(this, 'finalDeltaValue', final);
    flag(this, 'deltaBehavior', 'decrease');
    flag(this, 'realDelta', initial - final);

    this.assert(
      final - initial < 0
      , 'expected ' + msgObj + ' to decrease'
      , 'expected ' + msgObj + ' to not decrease'
    );
  }

  Assertion.addMethod('decrease', assertDecreases);
  Assertion.addMethod('decreases', assertDecreases);

  /**
   * ### .by(delta[, msg])
   *
   * When following an `.increase` assertion in the chain, `.by` asserts that
   * the subject of the `.increase` assertion increased by the given `delta`.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2);
   *
   * When following a `.decrease` assertion in the chain, `.by` asserts that the
   * subject of the `.decrease` assertion decreased by the given `delta`.
   *
   *     var myObj = {val: 1}
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2);
   *
   * When following a `.change` assertion in the chain, `.by` asserts that the
   * subject of the `.change` assertion either increased or decreased by the
   * given `delta`. However, it's dangerous to use `.change.by`. The problem is
   * that it creates uncertain expectations. It's often best to identify the
   * exact output that's expected, and then write an assertion that only accepts
   * that exact output.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; }
   *       , subtractTwo = function () { myObj.val -= 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(2); // Recommended
   *     expect(addTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   *     expect(subtractTwo).to.decrease(myObj, 'val').by(2); // Recommended
   *     expect(subtractTwo).to.change(myObj, 'val').by(2); // Not recommended
   *
   * Add `.not` earlier in the chain to negate `.by`. However, it's often best
   * to assert that the subject changed by its expected delta, rather than
   * asserting that it didn't change by one of countless unexpected deltas.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     // Recommended
   *     expect(addTwo).to.increase(myObj, 'val').by(2);
   *
   *     // Not recommended
   *     expect(addTwo).to.increase(myObj, 'val').but.not.by(3);
   *
   * `.by` accepts an optional `msg` argument which is a custom error message to
   * show when the assertion fails. The message can also be given as the second
   * argument to `expect`.
   *
   *     var myObj = {val: 1}
   *       , addTwo = function () { myObj.val += 2; };
   *
   *     expect(addTwo).to.increase(myObj, 'val').by(3, 'nooo why fail??');
   *     expect(addTwo, 'nooo why fail??').to.increase(myObj, 'val').by(3);
   *
   * @name by
   * @param {Number} delta
   * @param {String} msg _optional_
   * @namespace BDD
   * @api public
   */

  function assertDelta(delta, msg) {
    if (msg) flag(this, 'message', msg);

    var msgObj = flag(this, 'deltaMsgObj');
    var initial = flag(this, 'initialDeltaValue');
    var final = flag(this, 'finalDeltaValue');
    var behavior = flag(this, 'deltaBehavior');
    var realDelta = flag(this, 'realDelta');

    var expression;
    if (behavior === 'change') {
      expression = Math.abs(final - initial) === Math.abs(delta);
    } else {
      expression = realDelta === Math.abs(delta);
    }

    this.assert(
      expression
      , 'expected ' + msgObj + ' to ' + behavior + ' by ' + delta
      , 'expected ' + msgObj + ' to not ' + behavior + ' by ' + delta
    );
  }

  Assertion.addMethod('by', assertDelta);

  /**
   * ### .extensible
   *
   * Asserts that the target is extensible, which means that new properties can
   * be added to it. Primitives are never extensible.
   *
   *     expect({a: 1}).to.be.extensible;
   *
   * Add `.not` earlier in the chain to negate `.extensible`.
   *
   *     var nonExtensibleObject = Object.preventExtensions({})
   *       , sealedObject = Object.seal({})
   *       , frozenObject = Object.freeze({});
   *
   *     expect(nonExtensibleObject).to.not.be.extensible;
   *     expect(sealedObject).to.not.be.extensible;
   *     expect(frozenObject).to.not.be.extensible;
   *     expect(1).to.not.be.extensible;
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect(1, 'nooo why fail??').to.be.extensible;
   *
   * @name extensible
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('extensible', function() {
    var obj = flag(this, 'object');

    // In ES5, if the argument to this method is a primitive, then it will cause a TypeError.
    // In ES6, a non-object argument will be treated as if it was a non-extensible ordinary object, simply return false.
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isExtensible
    // The following provides ES6 behavior for ES5 environments.

    var isExtensible = obj === Object(obj) && Object.isExtensible(obj);

    this.assert(
      isExtensible
      , 'expected #{this} to be extensible'
      , 'expected #{this} to not be extensible'
    );
  });

  /**
   * ### .sealed
   *
   * Asserts that the target is sealed, which means that new properties can't be
   * added to it, and its existing properties can't be reconfigured or deleted.
   * However, it's possible that its existing properties can still be reassigned
   * to different values. Primitives are always sealed.
   *
   *     var sealedObject = Object.seal({});
   *     var frozenObject = Object.freeze({});
   *
   *     expect(sealedObject).to.be.sealed;
   *     expect(frozenObject).to.be.sealed;
   *     expect(1).to.be.sealed;
   *
   * Add `.not` earlier in the chain to negate `.sealed`.
   *
   *     expect({a: 1}).to.not.be.sealed;
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({a: 1}, 'nooo why fail??').to.be.sealed;
   *
   * @name sealed
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('sealed', function() {
    var obj = flag(this, 'object');

    // In ES5, if the argument to this method is a primitive, then it will cause a TypeError.
    // In ES6, a non-object argument will be treated as if it was a sealed ordinary object, simply return true.
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isSealed
    // The following provides ES6 behavior for ES5 environments.

    var isSealed = obj === Object(obj) ? Object.isSealed(obj) : true;

    this.assert(
      isSealed
      , 'expected #{this} to be sealed'
      , 'expected #{this} to not be sealed'
    );
  });

  /**
   * ### .frozen
   *
   * Asserts that the target is frozen, which means that new properties can't be
   * added to it, and its existing properties can't be reassigned to different
   * values, reconfigured, or deleted. Primitives are always frozen.
   *
   *     var frozenObject = Object.freeze({});
   *
   *     expect(frozenObject).to.be.frozen;
   *     expect(1).to.be.frozen;
   *
   * Add `.not` earlier in the chain to negate `.frozen`.
   *
   *     expect({a: 1}).to.not.be.frozen;
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect({a: 1}, 'nooo why fail??').to.be.frozen;
   *
   * @name frozen
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('frozen', function() {
    var obj = flag(this, 'object');

    // In ES5, if the argument to this method is a primitive, then it will cause a TypeError.
    // In ES6, a non-object argument will be treated as if it was a frozen ordinary object, simply return true.
    // See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/isFrozen
    // The following provides ES6 behavior for ES5 environments.

    var isFrozen = obj === Object(obj) ? Object.isFrozen(obj) : true;

    this.assert(
      isFrozen
      , 'expected #{this} to be frozen'
      , 'expected #{this} to not be frozen'
    );
  });

  /**
   * ### .finite
   *
   * Asserts that the target is a number, and isn't `NaN` or positive/negative
   * `Infinity`.
   *
   *     expect(1).to.be.finite;
   *
   * Add `.not` earlier in the chain to negate `.finite`. However, it's
   * dangerous to do so. The problem is that it creates uncertain expectations
   * by asserting that the subject either isn't a number, or that it's `NaN`, or
   * that it's positive `Infinity`, or that it's negative `Infinity`. It's often
   * best to identify the exact output that's expected, and then write an
   * assertion that only accepts that exact output.
   *
   * When the target isn't expected to be a number, it's often best to assert
   * that it's the expected type, rather than asserting that it isn't one of
   * many unexpected types.
   *
   *     expect('foo').to.be.a('string'); // Recommended
   *     expect('foo').to.not.be.finite; // Not recommended
   *
   * When the target is expected to be `NaN`, it's often best to assert exactly
   * that.
   *
   *     expect(NaN).to.be.NaN; // Recommended
   *     expect(NaN).to.not.be.finite; // Not recommended
   *
   * When the target is expected to be positive infinity, it's often best to
   * assert exactly that.
   *
   *     expect(Infinity).to.equal(Infinity); // Recommended
   *     expect(Infinity).to.not.be.finite; // Not recommended
   *
   * When the target is expected to be negative infinity, it's often best to
   * assert exactly that.
   *
   *     expect(-Infinity).to.equal(-Infinity); // Recommended
   *     expect(-Infinity).to.not.be.finite; // Not recommended
   *
   * A custom error message can be given as the second argument to `expect`.
   *
   *     expect('foo', 'nooo why fail??').to.be.finite;
   *
   * @name finite
   * @namespace BDD
   * @api public
   */

  Assertion.addProperty('finite', function(msg) {
    var obj = flag(this, 'object');

    this.assert(
        typeof obj === 'number' && isFinite(obj)
      , 'expected #{this} to be a finite number'
      , 'expected #{this} to not be a finite number'
    );
  });
};

},{}],8:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  /*!
   * Chai dependencies.
   */

  var Assertion = chai.Assertion
    , flag = util.flag;

  /*!
   * Module export.
   */

  /**
   * ### assert(expression, message)
   *
   * Write your own test expressions.
   *
   *     assert('foo' !== 'bar', 'foo is not bar');
   *     assert(Array.isArray([]), 'empty arrays are arrays');
   *
   * @param {Mixed} expression to test for truthiness
   * @param {String} message to display on error
   * @name assert
   * @namespace Assert
   * @api public
   */

  var assert = chai.assert = function (express, errmsg) {
    var test = new Assertion(null, null, chai.assert, true);
    test.assert(
        express
      , errmsg
      , '[ negation message unavailable ]'
    );
  };

  /**
   * ### .fail([message])
   * ### .fail(actual, expected, [message], [operator])
   *
   * Throw a failure. Node.js `assert` module-compatible.
   *
   *     assert.fail();
   *     assert.fail("custom error message");
   *     assert.fail(1, 2);
   *     assert.fail(1, 2, "custom error message");
   *     assert.fail(1, 2, "custom error message", ">");
   *     assert.fail(1, 2, undefined, ">");
   *
   * @name fail
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @param {String} operator
   * @namespace Assert
   * @api public
   */

  assert.fail = function (actual, expected, message, operator) {
    if (arguments.length < 2) {
        // Comply with Node's fail([message]) interface

        message = actual;
        actual = undefined;
    }

    message = message || 'assert.fail()';
    throw new chai.AssertionError(message, {
        actual: actual
      , expected: expected
      , operator: operator
    }, assert.fail);
  };

  /**
   * ### .isOk(object, [message])
   *
   * Asserts that `object` is truthy.
   *
   *     assert.isOk('everything', 'everything is ok');
   *     assert.isOk(false, 'this will fail');
   *
   * @name isOk
   * @alias ok
   * @param {Mixed} object to test
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isOk = function (val, msg) {
    new Assertion(val, msg, assert.isOk, true).is.ok;
  };

  /**
   * ### .isNotOk(object, [message])
   *
   * Asserts that `object` is falsy.
   *
   *     assert.isNotOk('everything', 'this will fail');
   *     assert.isNotOk(false, 'this will pass');
   *
   * @name isNotOk
   * @alias notOk
   * @param {Mixed} object to test
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotOk = function (val, msg) {
    new Assertion(val, msg, assert.isNotOk, true).is.not.ok;
  };

  /**
   * ### .equal(actual, expected, [message])
   *
   * Asserts non-strict equality (`==`) of `actual` and `expected`.
   *
   *     assert.equal(3, '3', '== coerces values to strings');
   *
   * @name equal
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.equal = function (act, exp, msg) {
    var test = new Assertion(act, msg, assert.equal, true);

    test.assert(
        exp == flag(test, 'object')
      , 'expected #{this} to equal #{exp}'
      , 'expected #{this} to not equal #{act}'
      , exp
      , act
      , true
    );
  };

  /**
   * ### .notEqual(actual, expected, [message])
   *
   * Asserts non-strict inequality (`!=`) of `actual` and `expected`.
   *
   *     assert.notEqual(3, 4, 'these numbers are not equal');
   *
   * @name notEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notEqual = function (act, exp, msg) {
    var test = new Assertion(act, msg, assert.notEqual, true);

    test.assert(
        exp != flag(test, 'object')
      , 'expected #{this} to not equal #{exp}'
      , 'expected #{this} to equal #{act}'
      , exp
      , act
      , true
    );
  };

  /**
   * ### .strictEqual(actual, expected, [message])
   *
   * Asserts strict equality (`===`) of `actual` and `expected`.
   *
   *     assert.strictEqual(true, true, 'these booleans are strictly equal');
   *
   * @name strictEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.strictEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.strictEqual, true).to.equal(exp);
  };

  /**
   * ### .notStrictEqual(actual, expected, [message])
   *
   * Asserts strict inequality (`!==`) of `actual` and `expected`.
   *
   *     assert.notStrictEqual(3, '3', 'no coercion for strict equality');
   *
   * @name notStrictEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notStrictEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.notStrictEqual, true).to.not.equal(exp);
  };

  /**
   * ### .deepEqual(actual, expected, [message])
   *
   * Asserts that `actual` is deeply equal to `expected`.
   *
   *     assert.deepEqual({ tea: 'green' }, { tea: 'green' });
   *
   * @name deepEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @alias deepStrictEqual
   * @namespace Assert
   * @api public
   */

  assert.deepEqual = assert.deepStrictEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.deepEqual, true).to.eql(exp);
  };

  /**
   * ### .notDeepEqual(actual, expected, [message])
   *
   * Assert that `actual` is not deeply equal to `expected`.
   *
   *     assert.notDeepEqual({ tea: 'green' }, { tea: 'jasmine' });
   *
   * @name notDeepEqual
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepEqual = function (act, exp, msg) {
    new Assertion(act, msg, assert.notDeepEqual, true).to.not.eql(exp);
  };

   /**
   * ### .isAbove(valueToCheck, valueToBeAbove, [message])
   *
   * Asserts `valueToCheck` is strictly greater than (>) `valueToBeAbove`.
   *
   *     assert.isAbove(5, 2, '5 is strictly greater than 2');
   *
   * @name isAbove
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeAbove
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isAbove = function (val, abv, msg) {
    new Assertion(val, msg, assert.isAbove, true).to.be.above(abv);
  };

   /**
   * ### .isAtLeast(valueToCheck, valueToBeAtLeast, [message])
   *
   * Asserts `valueToCheck` is greater than or equal to (>=) `valueToBeAtLeast`.
   *
   *     assert.isAtLeast(5, 2, '5 is greater or equal to 2');
   *     assert.isAtLeast(3, 3, '3 is greater or equal to 3');
   *
   * @name isAtLeast
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeAtLeast
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isAtLeast = function (val, atlst, msg) {
    new Assertion(val, msg, assert.isAtLeast, true).to.be.least(atlst);
  };

   /**
   * ### .isBelow(valueToCheck, valueToBeBelow, [message])
   *
   * Asserts `valueToCheck` is strictly less than (<) `valueToBeBelow`.
   *
   *     assert.isBelow(3, 6, '3 is strictly less than 6');
   *
   * @name isBelow
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeBelow
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isBelow = function (val, blw, msg) {
    new Assertion(val, msg, assert.isBelow, true).to.be.below(blw);
  };

   /**
   * ### .isAtMost(valueToCheck, valueToBeAtMost, [message])
   *
   * Asserts `valueToCheck` is less than or equal to (<=) `valueToBeAtMost`.
   *
   *     assert.isAtMost(3, 6, '3 is less than or equal to 6');
   *     assert.isAtMost(4, 4, '4 is less than or equal to 4');
   *
   * @name isAtMost
   * @param {Mixed} valueToCheck
   * @param {Mixed} valueToBeAtMost
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isAtMost = function (val, atmst, msg) {
    new Assertion(val, msg, assert.isAtMost, true).to.be.most(atmst);
  };

  /**
   * ### .isTrue(value, [message])
   *
   * Asserts that `value` is true.
   *
   *     var teaServed = true;
   *     assert.isTrue(teaServed, 'the tea has been served');
   *
   * @name isTrue
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isTrue = function (val, msg) {
    new Assertion(val, msg, assert.isTrue, true).is['true'];
  };

  /**
   * ### .isNotTrue(value, [message])
   *
   * Asserts that `value` is not true.
   *
   *     var tea = 'tasty chai';
   *     assert.isNotTrue(tea, 'great, time for tea!');
   *
   * @name isNotTrue
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotTrue = function (val, msg) {
    new Assertion(val, msg, assert.isNotTrue, true).to.not.equal(true);
  };

  /**
   * ### .isFalse(value, [message])
   *
   * Asserts that `value` is false.
   *
   *     var teaServed = false;
   *     assert.isFalse(teaServed, 'no tea yet? hmm...');
   *
   * @name isFalse
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isFalse = function (val, msg) {
    new Assertion(val, msg, assert.isFalse, true).is['false'];
  };

  /**
   * ### .isNotFalse(value, [message])
   *
   * Asserts that `value` is not false.
   *
   *     var tea = 'tasty chai';
   *     assert.isNotFalse(tea, 'great, time for tea!');
   *
   * @name isNotFalse
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotFalse = function (val, msg) {
    new Assertion(val, msg, assert.isNotFalse, true).to.not.equal(false);
  };

  /**
   * ### .isNull(value, [message])
   *
   * Asserts that `value` is null.
   *
   *     assert.isNull(err, 'there was no error');
   *
   * @name isNull
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNull = function (val, msg) {
    new Assertion(val, msg, assert.isNull, true).to.equal(null);
  };

  /**
   * ### .isNotNull(value, [message])
   *
   * Asserts that `value` is not null.
   *
   *     var tea = 'tasty chai';
   *     assert.isNotNull(tea, 'great, time for tea!');
   *
   * @name isNotNull
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotNull = function (val, msg) {
    new Assertion(val, msg, assert.isNotNull, true).to.not.equal(null);
  };

  /**
   * ### .isNaN
   *
   * Asserts that value is NaN.
   *
   *     assert.isNaN(NaN, 'NaN is NaN');
   *
   * @name isNaN
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNaN = function (val, msg) {
    new Assertion(val, msg, assert.isNaN, true).to.be.NaN;
  };

  /**
   * ### .isNotNaN
   *
   * Asserts that value is not NaN.
   *
   *     assert.isNotNaN(4, '4 is not NaN');
   *
   * @name isNotNaN
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */
  assert.isNotNaN = function (val, msg) {
    new Assertion(val, msg, assert.isNotNaN, true).not.to.be.NaN;
  };

  /**
   * ### .exists
   *
   * Asserts that the target is neither `null` nor `undefined`.
   *
   *     var foo = 'hi';
   *
   *     assert.exists(foo, 'foo is neither `null` nor `undefined`');
   *
   * @name exists
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.exists = function (val, msg) {
    new Assertion(val, msg, assert.exists, true).to.exist;
  };

  /**
   * ### .notExists
   *
   * Asserts that the target is either `null` or `undefined`.
   *
   *     var bar = null
   *       , baz;
   *
   *     assert.notExists(bar);
   *     assert.notExists(baz, 'baz is either null or undefined');
   *
   * @name notExists
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notExists = function (val, msg) {
    new Assertion(val, msg, assert.notExists, true).to.not.exist;
  };

  /**
   * ### .isUndefined(value, [message])
   *
   * Asserts that `value` is `undefined`.
   *
   *     var tea;
   *     assert.isUndefined(tea, 'no tea defined');
   *
   * @name isUndefined
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isUndefined = function (val, msg) {
    new Assertion(val, msg, assert.isUndefined, true).to.equal(undefined);
  };

  /**
   * ### .isDefined(value, [message])
   *
   * Asserts that `value` is not `undefined`.
   *
   *     var tea = 'cup of chai';
   *     assert.isDefined(tea, 'tea has been defined');
   *
   * @name isDefined
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isDefined = function (val, msg) {
    new Assertion(val, msg, assert.isDefined, true).to.not.equal(undefined);
  };

  /**
   * ### .isFunction(value, [message])
   *
   * Asserts that `value` is a function.
   *
   *     function serveTea() { return 'cup of tea'; };
   *     assert.isFunction(serveTea, 'great, we can have tea now');
   *
   * @name isFunction
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isFunction = function (val, msg) {
    new Assertion(val, msg, assert.isFunction, true).to.be.a('function');
  };

  /**
   * ### .isNotFunction(value, [message])
   *
   * Asserts that `value` is _not_ a function.
   *
   *     var serveTea = [ 'heat', 'pour', 'sip' ];
   *     assert.isNotFunction(serveTea, 'great, we have listed the steps');
   *
   * @name isNotFunction
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotFunction = function (val, msg) {
    new Assertion(val, msg, assert.isNotFunction, true).to.not.be.a('function');
  };

  /**
   * ### .isObject(value, [message])
   *
   * Asserts that `value` is an object of type 'Object' (as revealed by `Object.prototype.toString`).
   * _The assertion does not match subclassed objects._
   *
   *     var selection = { name: 'Chai', serve: 'with spices' };
   *     assert.isObject(selection, 'tea selection is an object');
   *
   * @name isObject
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isObject = function (val, msg) {
    new Assertion(val, msg, assert.isObject, true).to.be.a('object');
  };

  /**
   * ### .isNotObject(value, [message])
   *
   * Asserts that `value` is _not_ an object of type 'Object' (as revealed by `Object.prototype.toString`).
   *
   *     var selection = 'chai'
   *     assert.isNotObject(selection, 'tea selection is not an object');
   *     assert.isNotObject(null, 'null is not an object');
   *
   * @name isNotObject
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotObject = function (val, msg) {
    new Assertion(val, msg, assert.isNotObject, true).to.not.be.a('object');
  };

  /**
   * ### .isArray(value, [message])
   *
   * Asserts that `value` is an array.
   *
   *     var menu = [ 'green', 'chai', 'oolong' ];
   *     assert.isArray(menu, 'what kind of tea do we want?');
   *
   * @name isArray
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isArray = function (val, msg) {
    new Assertion(val, msg, assert.isArray, true).to.be.an('array');
  };

  /**
   * ### .isNotArray(value, [message])
   *
   * Asserts that `value` is _not_ an array.
   *
   *     var menu = 'green|chai|oolong';
   *     assert.isNotArray(menu, 'what kind of tea do we want?');
   *
   * @name isNotArray
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotArray = function (val, msg) {
    new Assertion(val, msg, assert.isNotArray, true).to.not.be.an('array');
  };

  /**
   * ### .isString(value, [message])
   *
   * Asserts that `value` is a string.
   *
   *     var teaOrder = 'chai';
   *     assert.isString(teaOrder, 'order placed');
   *
   * @name isString
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isString = function (val, msg) {
    new Assertion(val, msg, assert.isString, true).to.be.a('string');
  };

  /**
   * ### .isNotString(value, [message])
   *
   * Asserts that `value` is _not_ a string.
   *
   *     var teaOrder = 4;
   *     assert.isNotString(teaOrder, 'order placed');
   *
   * @name isNotString
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotString = function (val, msg) {
    new Assertion(val, msg, assert.isNotString, true).to.not.be.a('string');
  };

  /**
   * ### .isNumber(value, [message])
   *
   * Asserts that `value` is a number.
   *
   *     var cups = 2;
   *     assert.isNumber(cups, 'how many cups');
   *
   * @name isNumber
   * @param {Number} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNumber = function (val, msg) {
    new Assertion(val, msg, assert.isNumber, true).to.be.a('number');
  };

  /**
   * ### .isNotNumber(value, [message])
   *
   * Asserts that `value` is _not_ a number.
   *
   *     var cups = '2 cups please';
   *     assert.isNotNumber(cups, 'how many cups');
   *
   * @name isNotNumber
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotNumber = function (val, msg) {
    new Assertion(val, msg, assert.isNotNumber, true).to.not.be.a('number');
  };

   /**
   * ### .isFinite(value, [message])
   *
   * Asserts that `value` is a finite number. Unlike `.isNumber`, this will fail for `NaN` and `Infinity`.
   *
   *     var cups = 2;
   *     assert.isFinite(cups, 'how many cups');
   *
   *     assert.isFinite(NaN); // throws
   *
   * @name isFinite
   * @param {Number} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isFinite = function (val, msg) {
    new Assertion(val, msg, assert.isFinite, true).to.be.finite;
  };

  /**
   * ### .isBoolean(value, [message])
   *
   * Asserts that `value` is a boolean.
   *
   *     var teaReady = true
   *       , teaServed = false;
   *
   *     assert.isBoolean(teaReady, 'is the tea ready');
   *     assert.isBoolean(teaServed, 'has tea been served');
   *
   * @name isBoolean
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isBoolean = function (val, msg) {
    new Assertion(val, msg, assert.isBoolean, true).to.be.a('boolean');
  };

  /**
   * ### .isNotBoolean(value, [message])
   *
   * Asserts that `value` is _not_ a boolean.
   *
   *     var teaReady = 'yep'
   *       , teaServed = 'nope';
   *
   *     assert.isNotBoolean(teaReady, 'is the tea ready');
   *     assert.isNotBoolean(teaServed, 'has tea been served');
   *
   * @name isNotBoolean
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.isNotBoolean = function (val, msg) {
    new Assertion(val, msg, assert.isNotBoolean, true).to.not.be.a('boolean');
  };

  /**
   * ### .typeOf(value, name, [message])
   *
   * Asserts that `value`'s type is `name`, as determined by
   * `Object.prototype.toString`.
   *
   *     assert.typeOf({ tea: 'chai' }, 'object', 'we have an object');
   *     assert.typeOf(['chai', 'jasmine'], 'array', 'we have an array');
   *     assert.typeOf('tea', 'string', 'we have a string');
   *     assert.typeOf(/tea/, 'regexp', 'we have a regular expression');
   *     assert.typeOf(null, 'null', 'we have a null');
   *     assert.typeOf(undefined, 'undefined', 'we have an undefined');
   *
   * @name typeOf
   * @param {Mixed} value
   * @param {String} name
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.typeOf = function (val, type, msg) {
    new Assertion(val, msg, assert.typeOf, true).to.be.a(type);
  };

  /**
   * ### .notTypeOf(value, name, [message])
   *
   * Asserts that `value`'s type is _not_ `name`, as determined by
   * `Object.prototype.toString`.
   *
   *     assert.notTypeOf('tea', 'number', 'strings are not numbers');
   *
   * @name notTypeOf
   * @param {Mixed} value
   * @param {String} typeof name
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notTypeOf = function (val, type, msg) {
    new Assertion(val, msg, assert.notTypeOf, true).to.not.be.a(type);
  };

  /**
   * ### .instanceOf(object, constructor, [message])
   *
   * Asserts that `value` is an instance of `constructor`.
   *
   *     var Tea = function (name) { this.name = name; }
   *       , chai = new Tea('chai');
   *
   *     assert.instanceOf(chai, Tea, 'chai is an instance of tea');
   *
   * @name instanceOf
   * @param {Object} object
   * @param {Constructor} constructor
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.instanceOf = function (val, type, msg) {
    new Assertion(val, msg, assert.instanceOf, true).to.be.instanceOf(type);
  };

  /**
   * ### .notInstanceOf(object, constructor, [message])
   *
   * Asserts `value` is not an instance of `constructor`.
   *
   *     var Tea = function (name) { this.name = name; }
   *       , chai = new String('chai');
   *
   *     assert.notInstanceOf(chai, Tea, 'chai is not an instance of tea');
   *
   * @name notInstanceOf
   * @param {Object} object
   * @param {Constructor} constructor
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notInstanceOf = function (val, type, msg) {
    new Assertion(val, msg, assert.notInstanceOf, true)
      .to.not.be.instanceOf(type);
  };

  /**
   * ### .include(haystack, needle, [message])
   *
   * Asserts that `haystack` includes `needle`. Can be used to assert the
   * inclusion of a value in an array, a substring in a string, or a subset of
   * properties in an object.
   *
   *     assert.include([1,2,3], 2, 'array contains value');
   *     assert.include('foobar', 'foo', 'string contains substring');
   *     assert.include({ foo: 'bar', hello: 'universe' }, { foo: 'bar' }, 'object contains property');
   *
   * Strict equality (===) is used. When asserting the inclusion of a value in
   * an array, the array is searched for an element that's strictly equal to the
   * given value. When asserting a subset of properties in an object, the object
   * is searched for the given property keys, checking that each one is present
   * and strictly equal to the given property value. For instance:
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.include([obj1, obj2], obj1);
   *     assert.include({foo: obj1, bar: obj2}, {foo: obj1});
   *     assert.include({foo: obj1, bar: obj2}, {foo: obj1, bar: obj2});
   *
   * @name include
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.include = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.include, true).include(inc);
  };

  /**
   * ### .notInclude(haystack, needle, [message])
   *
   * Asserts that `haystack` does not include `needle`. Can be used to assert
   * the absence of a value in an array, a substring in a string, or a subset of
   * properties in an object.
   *
   *     assert.notInclude([1,2,3], 4, "array doesn't contain value");
   *     assert.notInclude('foobar', 'baz', "string doesn't contain substring");
   *     assert.notInclude({ foo: 'bar', hello: 'universe' }, { foo: 'baz' }, 'object doesn't contain property');
   *
   * Strict equality (===) is used. When asserting the absence of a value in an
   * array, the array is searched to confirm the absence of an element that's
   * strictly equal to the given value. When asserting a subset of properties in
   * an object, the object is searched to confirm that at least one of the given
   * property keys is either not present or not strictly equal to the given
   * property value. For instance:
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.notInclude([obj1, obj2], {a: 1});
   *     assert.notInclude({foo: obj1, bar: obj2}, {foo: {a: 1}});
   *     assert.notInclude({foo: obj1, bar: obj2}, {foo: obj1, bar: {b: 2}});
   *
   * @name notInclude
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.notInclude, true).not.include(inc);
  };

  /**
   * ### .deepInclude(haystack, needle, [message])
   *
   * Asserts that `haystack` includes `needle`. Can be used to assert the
   * inclusion of a value in an array or a subset of properties in an object.
   * Deep equality is used.
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.deepInclude([obj1, obj2], {a: 1});
   *     assert.deepInclude({foo: obj1, bar: obj2}, {foo: {a: 1}});
   *     assert.deepInclude({foo: obj1, bar: obj2}, {foo: {a: 1}, bar: {b: 2}});
   *
   * @name deepInclude
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.deepInclude, true).deep.include(inc);
  };

  /**
   * ### .notDeepInclude(haystack, needle, [message])
   *
   * Asserts that `haystack` does not include `needle`. Can be used to assert
   * the absence of a value in an array or a subset of properties in an object.
   * Deep equality is used.
   *
   *     var obj1 = {a: 1}
   *       , obj2 = {b: 2};
   *     assert.notDeepInclude([obj1, obj2], {a: 9});
   *     assert.notDeepInclude({foo: obj1, bar: obj2}, {foo: {a: 9}});
   *     assert.notDeepInclude({foo: obj1, bar: obj2}, {foo: {a: 1}, bar: {b: 9}});
   *
   * @name notDeepInclude
   * @param {Array|String} haystack
   * @param {Mixed} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.notDeepInclude, true).not.deep.include(inc);
  };

  /**
   * ### .nestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.nestedInclude({'.a': {'b': 'x'}}, {'\\.a.[b]': 'x'});
   *     assert.nestedInclude({'a': {'[b]': 'x'}}, {'a.\\[b\\]': 'x'});
   *
   * @name nestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.nestedInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.nestedInclude, true).nested.include(inc);
  };

  /**
   * ### .notNestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' does not include 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.notNestedInclude({'.a': {'b': 'x'}}, {'\\.a.b': 'y'});
   *     assert.notNestedInclude({'a': {'[b]': 'x'}}, {'a.\\[b\\]': 'y'});
   *
   * @name notNestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notNestedInclude = function (exp, inc, msg) {
    new Assertion(exp, msg, assert.notNestedInclude, true)
      .not.nested.include(inc);
  };

  /**
   * ### .deepNestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object while checking for deep equality.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.deepNestedInclude({a: {b: [{x: 1}]}}, {'a.b[0]': {x: 1}});
   *     assert.deepNestedInclude({'.a': {'[b]': {x: 1}}}, {'\\.a.\\[b\\]': {x: 1}});
   *
   * @name deepNestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepNestedInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.deepNestedInclude, true)
      .deep.nested.include(inc);
  };

  /**
   * ### .notDeepNestedInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' does not include 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object while checking for deep equality.
   * Enables the use of dot- and bracket-notation for referencing nested
   * properties.
   * '[]' and '.' in property names can be escaped using double backslashes.
   *
   *     assert.notDeepNestedInclude({a: {b: [{x: 1}]}}, {'a.b[0]': {y: 1}})
   *     assert.notDeepNestedInclude({'.a': {'[b]': {x: 1}}}, {'\\.a.\\[b\\]': {y: 2}});
   *
   * @name notDeepNestedInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepNestedInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.notDeepNestedInclude, true)
      .not.deep.nested.include(inc);
  };

  /**
   * ### .ownInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object while ignoring inherited properties.
   *
   *     assert.ownInclude({ a: 1 }, { a: 1 });
   *
   * @name ownInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.ownInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.ownInclude, true).own.include(inc);
  };

  /**
   * ### .notOwnInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object while ignoring inherited properties.
   *
   *     Object.prototype.b = 2;
   *
   *     assert.notOwnInclude({ a: 1 }, { b: 2 });
   *
   * @name notOwnInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notOwnInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.notOwnInclude, true).not.own.include(inc);
  };

  /**
   * ### .deepOwnInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the inclusion of a subset of properties in an
   * object while ignoring inherited properties and checking for deep equality.
   *
   *      assert.deepOwnInclude({a: {b: 2}}, {a: {b: 2}});
   *
   * @name deepOwnInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepOwnInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.deepOwnInclude, true)
      .deep.own.include(inc);
  };

   /**
   * ### .notDeepOwnInclude(haystack, needle, [message])
   *
   * Asserts that 'haystack' includes 'needle'.
   * Can be used to assert the absence of a subset of properties in an
   * object while ignoring inherited properties and checking for deep equality.
   *
   *      assert.notDeepOwnInclude({a: {b: 2}}, {a: {c: 3}});
   *
   * @name notDeepOwnInclude
   * @param {Object} haystack
   * @param {Object} needle
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepOwnInclude = function(exp, inc, msg) {
    new Assertion(exp, msg, assert.notDeepOwnInclude, true)
      .not.deep.own.include(inc);
  };

  /**
   * ### .match(value, regexp, [message])
   *
   * Asserts that `value` matches the regular expression `regexp`.
   *
   *     assert.match('foobar', /^foo/, 'regexp matches');
   *
   * @name match
   * @param {Mixed} value
   * @param {RegExp} regexp
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.match = function (exp, re, msg) {
    new Assertion(exp, msg, assert.match, true).to.match(re);
  };

  /**
   * ### .notMatch(value, regexp, [message])
   *
   * Asserts that `value` does not match the regular expression `regexp`.
   *
   *     assert.notMatch('foobar', /^foo/, 'regexp does not match');
   *
   * @name notMatch
   * @param {Mixed} value
   * @param {RegExp} regexp
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notMatch = function (exp, re, msg) {
    new Assertion(exp, msg, assert.notMatch, true).to.not.match(re);
  };

  /**
   * ### .property(object, property, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property`.
   *
   *     assert.property({ tea: { green: 'matcha' }}, 'tea');
   *     assert.property({ tea: { green: 'matcha' }}, 'toString');
   *
   * @name property
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.property = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.property, true).to.have.property(prop);
  };

  /**
   * ### .notProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a direct or inherited property named
   * by `property`.
   *
   *     assert.notProperty({ tea: { green: 'matcha' }}, 'coffee');
   *
   * @name notProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.notProperty, true)
      .to.not.have.property(prop);
  };

  /**
   * ### .propertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property` with a value given by `value`. Uses a strict equality check
   * (===).
   *
   *     assert.propertyVal({ tea: 'is good' }, 'tea', 'is good');
   *
   * @name propertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.propertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.propertyVal, true)
      .to.have.property(prop, val);
  };

  /**
   * ### .notPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct or inherited property named
   * by `property` with value given by `value`. Uses a strict equality check
   * (===).
   *
   *     assert.notPropertyVal({ tea: 'is good' }, 'tea', 'is bad');
   *     assert.notPropertyVal({ tea: 'is good' }, 'coffee', 'is good');
   *
   * @name notPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notPropertyVal, true)
      .to.not.have.property(prop, val);
  };

  /**
   * ### .deepPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property` with a value given by `value`. Uses a deep equality check.
   *
   *     assert.deepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'matcha' });
   *
   * @name deepPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.deepPropertyVal, true)
      .to.have.deep.property(prop, val);
  };

  /**
   * ### .notDeepPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct or inherited property named
   * by `property` with value given by `value`. Uses a deep equality check.
   *
   *     assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { black: 'matcha' });
   *     assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' });
   *     assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'coffee', { green: 'matcha' });
   *
   * @name notDeepPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notDeepPropertyVal, true)
      .to.not.have.deep.property(prop, val);
  };

  /**
   * ### .ownProperty(object, property, [message])
   *
   * Asserts that `object` has a direct property named by `property`. Inherited
   * properties aren't checked.
   *
   *     assert.ownProperty({ tea: { green: 'matcha' }}, 'tea');
   *
   * @name ownProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.ownProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.ownProperty, true)
      .to.have.own.property(prop);
  };

  /**
   * ### .notOwnProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a direct property named by
   * `property`. Inherited properties aren't checked.
   *
   *     assert.notOwnProperty({ tea: { green: 'matcha' }}, 'coffee');
   *     assert.notOwnProperty({}, 'toString');
   *
   * @name notOwnProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @api public
   */

  assert.notOwnProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.notOwnProperty, true)
      .to.not.have.own.property(prop);
  };

  /**
   * ### .ownPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct property named by `property` and a value
   * equal to the provided `value`. Uses a strict equality check (===).
   * Inherited properties aren't checked.
   *
   *     assert.ownPropertyVal({ coffee: 'is good'}, 'coffee', 'is good');
   *
   * @name ownPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.ownPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.ownPropertyVal, true)
      .to.have.own.property(prop, value);
  };

  /**
   * ### .notOwnPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct property named by `property`
   * with a value equal to the provided `value`. Uses a strict equality check
   * (===). Inherited properties aren't checked.
   *
   *     assert.notOwnPropertyVal({ tea: 'is better'}, 'tea', 'is worse');
   *     assert.notOwnPropertyVal({}, 'toString', Object.prototype.toString);
   *
   * @name notOwnPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.notOwnPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.notOwnPropertyVal, true)
      .to.not.have.own.property(prop, value);
  };

  /**
   * ### .deepOwnPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a direct property named by `property` and a value
   * equal to the provided `value`. Uses a deep equality check. Inherited
   * properties aren't checked.
   *
   *     assert.deepOwnPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'matcha' });
   *
   * @name deepOwnPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.deepOwnPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.deepOwnPropertyVal, true)
      .to.have.deep.own.property(prop, value);
  };

  /**
   * ### .notDeepOwnPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a direct property named by `property`
   * with a value equal to the provided `value`. Uses a deep equality check.
   * Inherited properties aren't checked.
   *
   *     assert.notDeepOwnPropertyVal({ tea: { green: 'matcha' } }, 'tea', { black: 'matcha' });
   *     assert.notDeepOwnPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' });
   *     assert.notDeepOwnPropertyVal({ tea: { green: 'matcha' } }, 'coffee', { green: 'matcha' });
   *     assert.notDeepOwnPropertyVal({}, 'toString', Object.prototype.toString);
   *
   * @name notDeepOwnPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @api public
   */

  assert.notDeepOwnPropertyVal = function (obj, prop, value, msg) {
    new Assertion(obj, msg, assert.notDeepOwnPropertyVal, true)
      .to.not.have.deep.own.property(prop, value);
  };

  /**
   * ### .nestedProperty(object, property, [message])
   *
   * Asserts that `object` has a direct or inherited property named by
   * `property`, which can be a string using dot- and bracket-notation for
   * nested reference.
   *
   *     assert.nestedProperty({ tea: { green: 'matcha' }}, 'tea.green');
   *
   * @name nestedProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.nestedProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.nestedProperty, true)
      .to.have.nested.property(prop);
  };

  /**
   * ### .notNestedProperty(object, property, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property`, which
   * can be a string using dot- and bracket-notation for nested reference. The
   * property cannot exist on the object nor anywhere in its prototype chain.
   *
   *     assert.notNestedProperty({ tea: { green: 'matcha' }}, 'tea.oolong');
   *
   * @name notNestedProperty
   * @param {Object} object
   * @param {String} property
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notNestedProperty = function (obj, prop, msg) {
    new Assertion(obj, msg, assert.notNestedProperty, true)
      .to.not.have.nested.property(prop);
  };

  /**
   * ### .nestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property` with value given
   * by `value`. `property` can use dot- and bracket-notation for nested
   * reference. Uses a strict equality check (===).
   *
   *     assert.nestedPropertyVal({ tea: { green: 'matcha' }}, 'tea.green', 'matcha');
   *
   * @name nestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.nestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.nestedPropertyVal, true)
      .to.have.nested.property(prop, val);
  };

  /**
   * ### .notNestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property` with
   * value given by `value`. `property` can use dot- and bracket-notation for
   * nested reference. Uses a strict equality check (===).
   *
   *     assert.notNestedPropertyVal({ tea: { green: 'matcha' }}, 'tea.green', 'konacha');
   *     assert.notNestedPropertyVal({ tea: { green: 'matcha' }}, 'coffee.green', 'matcha');
   *
   * @name notNestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notNestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notNestedPropertyVal, true)
      .to.not.have.nested.property(prop, val);
  };

  /**
   * ### .deepNestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` has a property named by `property` with a value given
   * by `value`. `property` can use dot- and bracket-notation for nested
   * reference. Uses a deep equality check.
   *
   *     assert.deepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { matcha: 'yum' });
   *
   * @name deepNestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.deepNestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.deepNestedPropertyVal, true)
      .to.have.deep.nested.property(prop, val);
  };

  /**
   * ### .notDeepNestedPropertyVal(object, property, value, [message])
   *
   * Asserts that `object` does _not_ have a property named by `property` with
   * value given by `value`. `property` can use dot- and bracket-notation for
   * nested reference. Uses a deep equality check.
   *
   *     assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { oolong: 'yum' });
   *     assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { matcha: 'yuck' });
   *     assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.black', { matcha: 'yum' });
   *
   * @name notDeepNestedPropertyVal
   * @param {Object} object
   * @param {String} property
   * @param {Mixed} value
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notDeepNestedPropertyVal = function (obj, prop, val, msg) {
    new Assertion(obj, msg, assert.notDeepNestedPropertyVal, true)
      .to.not.have.deep.nested.property(prop, val);
  }

  /**
   * ### .lengthOf(object, length, [message])
   *
   * Asserts that `object` has a `length` or `size` with the expected value.
   *
   *     assert.lengthOf([1,2,3], 3, 'array has length of 3');
   *     assert.lengthOf('foobar', 6, 'string has length of 6');
   *     assert.lengthOf(new Set([1,2,3]), 3, 'set has size of 3');
   *     assert.lengthOf(new Map([['a',1],['b',2],['c',3]]), 3, 'map has size of 3');
   *
   * @name lengthOf
   * @param {Mixed} object
   * @param {Number} length
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.lengthOf = function (exp, len, msg) {
    new Assertion(exp, msg, assert.lengthOf, true).to.have.lengthOf(len);
  };

  /**
   * ### .hasAnyKeys(object, [keys], [message])
   *
   * Asserts that `object` has at least one of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAnyKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'iDontExist', 'baz']);
   *     assert.hasAnyKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, iDontExist: 99, baz: 1337});
   *     assert.hasAnyKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}, 'key']);
   *     assert.hasAnyKeys(new Set([{foo: 'bar'}, 'anotherKey']), [{foo: 'bar'}, 'anotherKey']);
   *
   * @name hasAnyKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAnyKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAnyKeys, true).to.have.any.keys(keys);
  }

  /**
   * ### .hasAllKeys(object, [keys], [message])
   *
   * Asserts that `object` has all and only all of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAllKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'bar', 'baz']);
   *     assert.hasAllKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, bar: 99, baz: 1337]);
   *     assert.hasAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}, 'key']);
   *     assert.hasAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{foo: 'bar'}, 'anotherKey']);
   *
   * @name hasAllKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAllKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAllKeys, true).to.have.all.keys(keys);
  }

  /**
   * ### .containsAllKeys(object, [keys], [message])
   *
   * Asserts that `object` has all of the `keys` provided but may have more keys not listed.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'baz']);
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, ['foo', 'bar', 'baz']);
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, baz: 1337});
   *     assert.containsAllKeys({foo: 1, bar: 2, baz: 3}, {foo: 30, bar: 99, baz: 1337});
   *     assert.containsAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}]);
   *     assert.containsAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{foo: 1}, 'key']);
   *     assert.containsAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{foo: 'bar'}]);
   *     assert.containsAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{foo: 'bar'}, 'anotherKey']);
   *
   * @name containsAllKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.containsAllKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.containsAllKeys, true)
      .to.contain.all.keys(keys);
  }

  /**
   * ### .doesNotHaveAnyKeys(object, [keys], [message])
   *
   * Asserts that `object` has none of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAnyKeys({foo: 1, bar: 2, baz: 3}, ['one', 'two', 'example']);
   *     assert.doesNotHaveAnyKeys({foo: 1, bar: 2, baz: 3}, {one: 1, two: 2, example: 'foo'});
   *     assert.doesNotHaveAnyKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{one: 'two'}, 'example']);
   *     assert.doesNotHaveAnyKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{one: 'two'}, 'example']);
   *
   * @name doesNotHaveAnyKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAnyKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAnyKeys, true)
      .to.not.have.any.keys(keys);
  }

  /**
   * ### .doesNotHaveAllKeys(object, [keys], [message])
   *
   * Asserts that `object` does not have at least one of the `keys` provided.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAllKeys({foo: 1, bar: 2, baz: 3}, ['one', 'two', 'example']);
   *     assert.doesNotHaveAllKeys({foo: 1, bar: 2, baz: 3}, {one: 1, two: 2, example: 'foo'});
   *     assert.doesNotHaveAllKeys(new Map([[{foo: 1}, 'bar'], ['key', 'value']]), [{one: 'two'}, 'example']);
   *     assert.doesNotHaveAllKeys(new Set([{foo: 'bar'}, 'anotherKey'], [{one: 'two'}, 'example']);
   *
   * @name doesNotHaveAllKeys
   * @param {Mixed} object
   * @param {String[]} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAllKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAllKeys, true)
      .to.not.have.all.keys(keys);
  }

  /**
   * ### .hasAnyDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` has at least one of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {one: 'one'});
   *     assert.hasAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), [{one: 'one'}, {two: 'two'}]);
   *     assert.hasAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{one: 'one'}, {two: 'two'}]);
   *     assert.hasAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {one: 'one'});
   *     assert.hasAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {three: 'three'}]);
   *     assert.hasAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {two: 'two'}]);
   *
   * @name doesNotHaveAllKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAnyDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAnyDeepKeys, true)
      .to.have.any.deep.keys(keys);
  }

 /**
   * ### .hasAllDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` has all and only all of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.hasAllDeepKeys(new Map([[{one: 'one'}, 'valueOne']]), {one: 'one'});
   *     assert.hasAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{one: 'one'}, {two: 'two'}]);
   *     assert.hasAllDeepKeys(new Set([{one: 'one'}]), {one: 'one'});
   *     assert.hasAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {two: 'two'}]);
   *
   * @name hasAllDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.hasAllDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.hasAllDeepKeys, true)
      .to.have.all.deep.keys(keys);
  }

 /**
   * ### .containsAllDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` contains all of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.containsAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {one: 'one'});
   *     assert.containsAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{one: 'one'}, {two: 'two'}]);
   *     assert.containsAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {one: 'one'});
   *     assert.containsAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {two: 'two'}]);
   *
   * @name containsAllDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.containsAllDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.containsAllDeepKeys, true)
      .to.contain.all.deep.keys(keys);
  }

 /**
   * ### .doesNotHaveAnyDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` has none of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {thisDoesNot: 'exist'});
   *     assert.doesNotHaveAnyDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{twenty: 'twenty'}, {fifty: 'fifty'}]);
   *     assert.doesNotHaveAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {twenty: 'twenty'});
   *     assert.doesNotHaveAnyDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{twenty: 'twenty'}, {fifty: 'fifty'}]);
   *
   * @name doesNotHaveAnyDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAnyDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAnyDeepKeys, true)
      .to.not.have.any.deep.keys(keys);
  }

 /**
   * ### .doesNotHaveAllDeepKeys(object, [keys], [message])
   *
   * Asserts that `object` does not have at least one of the `keys` provided.
   * Since Sets and Maps can have objects as keys you can use this assertion to perform
   * a deep comparison.
   * You can also provide a single object instead of a `keys` array and its keys
   * will be used as the expected set of keys.
   *
   *     assert.doesNotHaveAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [1, 2]]), {thisDoesNot: 'exist'});
   *     assert.doesNotHaveAllDeepKeys(new Map([[{one: 'one'}, 'valueOne'], [{two: 'two'}, 'valueTwo']]), [{twenty: 'twenty'}, {one: 'one'}]);
   *     assert.doesNotHaveAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), {twenty: 'twenty'});
   *     assert.doesNotHaveAllDeepKeys(new Set([{one: 'one'}, {two: 'two'}]), [{one: 'one'}, {fifty: 'fifty'}]);
   *
   * @name doesNotHaveAllDeepKeys
   * @param {Mixed} object
   * @param {Array|Object} keys
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.doesNotHaveAllDeepKeys = function (obj, keys, msg) {
    new Assertion(obj, msg, assert.doesNotHaveAllDeepKeys, true)
      .to.not.have.all.deep.keys(keys);
  }

 /**
   * ### .throws(fn, [errorLike/string/regexp], [string/regexp], [message])
   *
   * If `errorLike` is an `Error` constructor, asserts that `fn` will throw an error that is an
   * instance of `errorLike`.
   * If `errorLike` is an `Error` instance, asserts that the error thrown is the same
   * instance as `errorLike`.
   * If `errMsgMatcher` is provided, it also asserts that the error thrown will have a
   * message matching `errMsgMatcher`.
   *
   *     assert.throws(fn, 'Error thrown must have this msg');
   *     assert.throws(fn, /Error thrown must have a msg that matches this/);
   *     assert.throws(fn, ReferenceError);
   *     assert.throws(fn, errorInstance);
   *     assert.throws(fn, ReferenceError, 'Error thrown must be a ReferenceError and have this msg');
   *     assert.throws(fn, errorInstance, 'Error thrown must be the same errorInstance and have this msg');
   *     assert.throws(fn, ReferenceError, /Error thrown must be a ReferenceError and match this/);
   *     assert.throws(fn, errorInstance, /Error thrown must be the same errorInstance and match this/);
   *
   * @name throws
   * @alias throw
   * @alias Throw
   * @param {Function} fn
   * @param {ErrorConstructor|Error} errorLike
   * @param {RegExp|String} errMsgMatcher
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @namespace Assert
   * @api public
   */

  assert.throws = function (fn, errorLike, errMsgMatcher, msg) {
    if ('string' === typeof errorLike || errorLike instanceof RegExp) {
      errMsgMatcher = errorLike;
      errorLike = null;
    }

    var assertErr = new Assertion(fn, msg, assert.throws, true)
      .to.throw(errorLike, errMsgMatcher);
    return flag(assertErr, 'object');
  };

  /**
   * ### .doesNotThrow(fn, [errorLike/string/regexp], [string/regexp], [message])
   *
   * If `errorLike` is an `Error` constructor, asserts that `fn` will _not_ throw an error that is an
   * instance of `errorLike`.
   * If `errorLike` is an `Error` instance, asserts that the error thrown is _not_ the same
   * instance as `errorLike`.
   * If `errMsgMatcher` is provided, it also asserts that the error thrown will _not_ have a
   * message matching `errMsgMatcher`.
   *
   *     assert.doesNotThrow(fn, 'Any Error thrown must not have this message');
   *     assert.doesNotThrow(fn, /Any Error thrown must not match this/);
   *     assert.doesNotThrow(fn, Error);
   *     assert.doesNotThrow(fn, errorInstance);
   *     assert.doesNotThrow(fn, Error, 'Error must not have this message');
   *     assert.doesNotThrow(fn, errorInstance, 'Error must not have this message');
   *     assert.doesNotThrow(fn, Error, /Error must not match this/);
   *     assert.doesNotThrow(fn, errorInstance, /Error must not match this/);
   *
   * @name doesNotThrow
   * @param {Function} fn
   * @param {ErrorConstructor} errorLike
   * @param {RegExp|String} errMsgMatcher
   * @param {String} message
   * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
   * @namespace Assert
   * @api public
   */

  assert.doesNotThrow = function (fn, errorLike, errMsgMatcher, msg) {
    if ('string' === typeof errorLike || errorLike instanceof RegExp) {
      errMsgMatcher = errorLike;
      errorLike = null;
    }

    new Assertion(fn, msg, assert.doesNotThrow, true)
      .to.not.throw(errorLike, errMsgMatcher);
  };

  /**
   * ### .operator(val1, operator, val2, [message])
   *
   * Compares two values using `operator`.
   *
   *     assert.operator(1, '<', 2, 'everything is ok');
   *     assert.operator(1, '>', 2, 'this will fail');
   *
   * @name operator
   * @param {Mixed} val1
   * @param {String} operator
   * @param {Mixed} val2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.operator = function (val, operator, val2, msg) {
    var ok;
    switch(operator) {
      case '==':
        ok = val == val2;
        break;
      case '===':
        ok = val === val2;
        break;
      case '>':
        ok = val > val2;
        break;
      case '>=':
        ok = val >= val2;
        break;
      case '<':
        ok = val < val2;
        break;
      case '<=':
        ok = val <= val2;
        break;
      case '!=':
        ok = val != val2;
        break;
      case '!==':
        ok = val !== val2;
        break;
      default:
        msg = msg ? msg + ': ' : msg;
        throw new chai.AssertionError(
          msg + 'Invalid operator "' + operator + '"',
          undefined,
          assert.operator
        );
    }
    var test = new Assertion(ok, msg, assert.operator, true);
    test.assert(
        true === flag(test, 'object')
      , 'expected ' + util.inspect(val) + ' to be ' + operator + ' ' + util.inspect(val2)
      , 'expected ' + util.inspect(val) + ' to not be ' + operator + ' ' + util.inspect(val2) );
  };

  /**
   * ### .closeTo(actual, expected, delta, [message])
   *
   * Asserts that the target is equal `expected`, to within a +/- `delta` range.
   *
   *     assert.closeTo(1.5, 1, 0.5, 'numbers are close');
   *
   * @name closeTo
   * @param {Number} actual
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.closeTo = function (act, exp, delta, msg) {
    new Assertion(act, msg, assert.closeTo, true).to.be.closeTo(exp, delta);
  };

  /**
   * ### .approximately(actual, expected, delta, [message])
   *
   * Asserts that the target is equal `expected`, to within a +/- `delta` range.
   *
   *     assert.approximately(1.5, 1, 0.5, 'numbers are close');
   *
   * @name approximately
   * @param {Number} actual
   * @param {Number} expected
   * @param {Number} delta
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.approximately = function (act, exp, delta, msg) {
    new Assertion(act, msg, assert.approximately, true)
      .to.be.approximately(exp, delta);
  };

  /**
   * ### .sameMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in any order. Uses a
   * strict equality check (===).
   *
   *     assert.sameMembers([ 1, 2, 3 ], [ 2, 1, 3 ], 'same members');
   *
   * @name sameMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameMembers, true)
      .to.have.same.members(set2);
  }

  /**
   * ### .notSameMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in any order.
   * Uses a strict equality check (===).
   *
   *     assert.notSameMembers([ 1, 2, 3 ], [ 5, 1, 3 ], 'not same members');
   *
   * @name notSameMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameMembers, true)
      .to.not.have.same.members(set2);
  }

  /**
   * ### .sameDeepMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in any order. Uses a
   * deep equality check.
   *
   *     assert.sameDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [{ b: 2 }, { a: 1 }, { c: 3 }], 'same deep members');
   *
   * @name sameDeepMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameDeepMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameDeepMembers, true)
      .to.have.same.deep.members(set2);
  }

  /**
   * ### .notSameDeepMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in any order.
   * Uses a deep equality check.
   *
   *     assert.notSameDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [{ b: 2 }, { a: 1 }, { f: 5 }], 'not same deep members');
   *
   * @name notSameDeepMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameDeepMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameDeepMembers, true)
      .to.not.have.same.deep.members(set2);
  }

  /**
   * ### .sameOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in the same order.
   * Uses a strict equality check (===).
   *
   *     assert.sameOrderedMembers([ 1, 2, 3 ], [ 1, 2, 3 ], 'same ordered members');
   *
   * @name sameOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameOrderedMembers, true)
      .to.have.same.ordered.members(set2);
  }

  /**
   * ### .notSameOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in the same
   * order. Uses a strict equality check (===).
   *
   *     assert.notSameOrderedMembers([ 1, 2, 3 ], [ 2, 1, 3 ], 'not same ordered members');
   *
   * @name notSameOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameOrderedMembers, true)
      .to.not.have.same.ordered.members(set2);
  }

  /**
   * ### .sameDeepOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` have the same members in the same order.
   * Uses a deep equality check.
   *
   * assert.sameDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { b: 2 }, { c: 3 } ], 'same deep ordered members');
   *
   * @name sameDeepOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.sameDeepOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.sameDeepOrderedMembers, true)
      .to.have.same.deep.ordered.members(set2);
  }

  /**
   * ### .notSameDeepOrderedMembers(set1, set2, [message])
   *
   * Asserts that `set1` and `set2` don't have the same members in the same
   * order. Uses a deep equality check.
   *
   * assert.notSameDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { b: 2 }, { z: 5 } ], 'not same deep ordered members');
   * assert.notSameDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { a: 1 }, { c: 3 } ], 'not same deep ordered members');
   *
   * @name notSameDeepOrderedMembers
   * @param {Array} set1
   * @param {Array} set2
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notSameDeepOrderedMembers = function (set1, set2, msg) {
    new Assertion(set1, msg, assert.notSameDeepOrderedMembers, true)
      .to.not.have.same.deep.ordered.members(set2);
  }

  /**
   * ### .includeMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in any order. Uses a
   * strict equality check (===). Duplicates are ignored.
   *
   *     assert.includeMembers([ 1, 2, 3 ], [ 2, 1, 2 ], 'include members');
   *
   * @name includeMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeMembers, true)
      .to.include.members(subset);
  }

  /**
   * ### .notIncludeMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in any order. Uses a
   * strict equality check (===). Duplicates are ignored.
   *
   *     assert.notIncludeMembers([ 1, 2, 3 ], [ 5, 1 ], 'not include members');
   *
   * @name notIncludeMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeMembers, true)
      .to.not.include.members(subset);
  }

  /**
   * ### .includeDeepMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in any order. Uses a deep
   * equality check. Duplicates are ignored.
   *
   *     assert.includeDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { a: 1 }, { b: 2 } ], 'include deep members');
   *
   * @name includeDeepMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeDeepMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeDeepMembers, true)
      .to.include.deep.members(subset);
  }

  /**
   * ### .notIncludeDeepMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in any order. Uses a
   * deep equality check. Duplicates are ignored.
   *
   *     assert.notIncludeDeepMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { f: 5 } ], 'not include deep members');
   *
   * @name notIncludeDeepMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeDeepMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeDeepMembers, true)
      .to.not.include.deep.members(subset);
  }

  /**
   * ### .includeOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a strict equality
   * check (===).
   *
   *     assert.includeOrderedMembers([ 1, 2, 3 ], [ 1, 2 ], 'include ordered members');
   *
   * @name includeOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeOrderedMembers, true)
      .to.include.ordered.members(subset);
  }

  /**
   * ### .notIncludeOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a strict equality
   * check (===).
   *
   *     assert.notIncludeOrderedMembers([ 1, 2, 3 ], [ 2, 1 ], 'not include ordered members');
   *     assert.notIncludeOrderedMembers([ 1, 2, 3 ], [ 2, 3 ], 'not include ordered members');
   *
   * @name notIncludeOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeOrderedMembers, true)
      .to.not.include.ordered.members(subset);
  }

  /**
   * ### .includeDeepOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` is included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a deep equality
   * check.
   *
   *     assert.includeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { b: 2 } ], 'include deep ordered members');
   *
   * @name includeDeepOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.includeDeepOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.includeDeepOrderedMembers, true)
      .to.include.deep.ordered.members(subset);
  }

  /**
   * ### .notIncludeDeepOrderedMembers(superset, subset, [message])
   *
   * Asserts that `subset` isn't included in `superset` in the same order
   * beginning with the first element in `superset`. Uses a deep equality
   * check.
   *
   *     assert.notIncludeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { a: 1 }, { f: 5 } ], 'not include deep ordered members');
   *     assert.notIncludeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { a: 1 } ], 'not include deep ordered members');
   *     assert.notIncludeDeepOrderedMembers([ { a: 1 }, { b: 2 }, { c: 3 } ], [ { b: 2 }, { c: 3 } ], 'not include deep ordered members');
   *
   * @name notIncludeDeepOrderedMembers
   * @param {Array} superset
   * @param {Array} subset
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.notIncludeDeepOrderedMembers = function (superset, subset, msg) {
    new Assertion(superset, msg, assert.notIncludeDeepOrderedMembers, true)
      .to.not.include.deep.ordered.members(subset);
  }

  /**
   * ### .oneOf(inList, list, [message])
   *
   * Asserts that non-object, non-array value `inList` appears in the flat array `list`.
   *
   *     assert.oneOf(1, [ 2, 1 ], 'Not found in list');
   *
   * @name oneOf
   * @param {*} inList
   * @param {Array<*>} list
   * @param {String} message
   * @namespace Assert
   * @api public
   */

  assert.oneOf = function (inList, list, msg) {
    new Assertion(inList, msg, assert.oneOf, true).to.be.oneOf(list);
  }

  /**
   * ### .changes(function, object, property, [message])
   *
   * Asserts that a function changes the value of a property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 22 };
   *     assert.changes(fn, obj, 'val');
   *
   * @name changes
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.changes = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.changes, true).to.change(obj, prop);
  }

   /**
   * ### .changesBy(function, object, property, delta, [message])
   *
   * Asserts that a function changes the value of a property by an amount (delta).
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val += 2 };
   *     assert.changesBy(fn, obj, 'val', 2);
   *
   * @name changesBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.changesBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.changesBy, true)
      .to.change(obj, prop).by(delta);
  }

   /**
   * ### .doesNotChange(function, object, property, [message])
   *
   * Asserts that a function does not change the value of a property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { console.log('foo'); };
   *     assert.doesNotChange(fn, obj, 'val');
   *
   * @name doesNotChange
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotChange = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotChange, true)
      .to.not.change(obj, prop);
  }

  /**
   * ### .changesButNotBy(function, object, property, delta, [message])
   *
   * Asserts that a function does not change the value of a property or of a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val += 10 };
   *     assert.changesButNotBy(fn, obj, 'val', 5);
   *
   * @name changesButNotBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.changesButNotBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.changesButNotBy, true)
      .to.change(obj, prop).but.not.by(delta);
  }

  /**
   * ### .increases(function, object, property, [message])
   *
   * Asserts that a function increases a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 13 };
   *     assert.increases(fn, obj, 'val');
   *
   * @name increases
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.increases = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.increases, true)
      .to.increase(obj, prop);
  }

  /**
   * ### .increasesBy(function, object, property, delta, [message])
   *
   * Asserts that a function increases a numeric object property or a function's return value by an amount (delta).
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val += 10 };
   *     assert.increasesBy(fn, obj, 'val', 10);
   *
   * @name increasesBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.increasesBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.increasesBy, true)
      .to.increase(obj, prop).by(delta);
  }

  /**
   * ### .doesNotIncrease(function, object, property, [message])
   *
   * Asserts that a function does not increase a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 8 };
   *     assert.doesNotIncrease(fn, obj, 'val');
   *
   * @name doesNotIncrease
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotIncrease = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotIncrease, true)
      .to.not.increase(obj, prop);
  }

  /**
   * ### .increasesButNotBy(function, object, property, [message])
   *
   * Asserts that a function does not increase a numeric object property or function's return value by an amount (delta).
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 15 };
   *     assert.increasesButNotBy(fn, obj, 'val', 10);
   *
   * @name increasesButNotBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.increasesButNotBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.increasesButNotBy, true)
      .to.increase(obj, prop).but.not.by(delta);
  }

  /**
   * ### .decreases(function, object, property, [message])
   *
   * Asserts that a function decreases a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 5 };
   *     assert.decreases(fn, obj, 'val');
   *
   * @name decreases
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.decreases = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.decreases, true)
      .to.decrease(obj, prop);
  }

  /**
   * ### .decreasesBy(function, object, property, delta, [message])
   *
   * Asserts that a function decreases a numeric object property or a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val -= 5 };
   *     assert.decreasesBy(fn, obj, 'val', 5);
   *
   * @name decreasesBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.decreasesBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.decreasesBy, true)
      .to.decrease(obj, prop).by(delta);
  }

  /**
   * ### .doesNotDecrease(function, object, property, [message])
   *
   * Asserts that a function does not decreases a numeric object property.
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 15 };
   *     assert.doesNotDecrease(fn, obj, 'val');
   *
   * @name doesNotDecrease
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotDecrease = function (fn, obj, prop, msg) {
    if (arguments.length === 3 && typeof obj === 'function') {
      msg = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotDecrease, true)
      .to.not.decrease(obj, prop);
  }

  /**
   * ### .doesNotDecreaseBy(function, object, property, delta, [message])
   *
   * Asserts that a function does not decreases a numeric object property or a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 5 };
   *     assert.doesNotDecreaseBy(fn, obj, 'val', 1);
   *
   * @name doesNotDecrease
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.doesNotDecreaseBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    return new Assertion(fn, msg, assert.doesNotDecreaseBy, true)
      .to.not.decrease(obj, prop).by(delta);
  }

  /**
   * ### .decreasesButNotBy(function, object, property, delta, [message])
   *
   * Asserts that a function does not decreases a numeric object property or a function's return value by an amount (delta)
   *
   *     var obj = { val: 10 };
   *     var fn = function() { obj.val = 5 };
   *     assert.decreasesButNotBy(fn, obj, 'val', 1);
   *
   * @name decreasesButNotBy
   * @param {Function} modifier function
   * @param {Object} object or getter function
   * @param {String} property name _optional_
   * @param {Number} change amount (delta)
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.decreasesButNotBy = function (fn, obj, prop, delta, msg) {
    if (arguments.length === 4 && typeof obj === 'function') {
      var tmpMsg = delta;
      delta = prop;
      msg = tmpMsg;
    } else if (arguments.length === 3) {
      delta = prop;
      prop = null;
    }

    new Assertion(fn, msg, assert.decreasesButNotBy, true)
      .to.decrease(obj, prop).but.not.by(delta);
  }

  /*!
   * ### .ifError(object)
   *
   * Asserts if value is not a false value, and throws if it is a true value.
   * This is added to allow for chai to be a drop-in replacement for Node's
   * assert class.
   *
   *     var err = new Error('I am a custom error');
   *     assert.ifError(err); // Rethrows err!
   *
   * @name ifError
   * @param {Object} object
   * @namespace Assert
   * @api public
   */

  assert.ifError = function (val) {
    if (val) {
      throw(val);
    }
  };

  /**
   * ### .isExtensible(object)
   *
   * Asserts that `object` is extensible (can have new properties added to it).
   *
   *     assert.isExtensible({});
   *
   * @name isExtensible
   * @alias extensible
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isExtensible = function (obj, msg) {
    new Assertion(obj, msg, assert.isExtensible, true).to.be.extensible;
  };

  /**
   * ### .isNotExtensible(object)
   *
   * Asserts that `object` is _not_ extensible.
   *
   *     var nonExtensibleObject = Object.preventExtensions({});
   *     var sealedObject = Object.seal({});
   *     var frozenObject = Object.freeze({});
   *
   *     assert.isNotExtensible(nonExtensibleObject);
   *     assert.isNotExtensible(sealedObject);
   *     assert.isNotExtensible(frozenObject);
   *
   * @name isNotExtensible
   * @alias notExtensible
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotExtensible = function (obj, msg) {
    new Assertion(obj, msg, assert.isNotExtensible, true).to.not.be.extensible;
  };

  /**
   * ### .isSealed(object)
   *
   * Asserts that `object` is sealed (cannot have new properties added to it
   * and its existing properties cannot be removed).
   *
   *     var sealedObject = Object.seal({});
   *     var frozenObject = Object.seal({});
   *
   *     assert.isSealed(sealedObject);
   *     assert.isSealed(frozenObject);
   *
   * @name isSealed
   * @alias sealed
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isSealed = function (obj, msg) {
    new Assertion(obj, msg, assert.isSealed, true).to.be.sealed;
  };

  /**
   * ### .isNotSealed(object)
   *
   * Asserts that `object` is _not_ sealed.
   *
   *     assert.isNotSealed({});
   *
   * @name isNotSealed
   * @alias notSealed
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotSealed = function (obj, msg) {
    new Assertion(obj, msg, assert.isNotSealed, true).to.not.be.sealed;
  };

  /**
   * ### .isFrozen(object)
   *
   * Asserts that `object` is frozen (cannot have new properties added to it
   * and its existing properties cannot be modified).
   *
   *     var frozenObject = Object.freeze({});
   *     assert.frozen(frozenObject);
   *
   * @name isFrozen
   * @alias frozen
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isFrozen = function (obj, msg) {
    new Assertion(obj, msg, assert.isFrozen, true).to.be.frozen;
  };

  /**
   * ### .isNotFrozen(object)
   *
   * Asserts that `object` is _not_ frozen.
   *
   *     assert.isNotFrozen({});
   *
   * @name isNotFrozen
   * @alias notFrozen
   * @param {Object} object
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotFrozen = function (obj, msg) {
    new Assertion(obj, msg, assert.isNotFrozen, true).to.not.be.frozen;
  };

  /**
   * ### .isEmpty(target)
   *
   * Asserts that the target does not contain any values.
   * For arrays and strings, it checks the `length` property.
   * For `Map` and `Set` instances, it checks the `size` property.
   * For non-function objects, it gets the count of own
   * enumerable string keys.
   *
   *     assert.isEmpty([]);
   *     assert.isEmpty('');
   *     assert.isEmpty(new Map);
   *     assert.isEmpty({});
   *
   * @name isEmpty
   * @alias empty
   * @param {Object|Array|String|Map|Set} target
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isEmpty = function(val, msg) {
    new Assertion(val, msg, assert.isEmpty, true).to.be.empty;
  };

  /**
   * ### .isNotEmpty(target)
   *
   * Asserts that the target contains values.
   * For arrays and strings, it checks the `length` property.
   * For `Map` and `Set` instances, it checks the `size` property.
   * For non-function objects, it gets the count of own
   * enumerable string keys.
   *
   *     assert.isNotEmpty([1, 2]);
   *     assert.isNotEmpty('34');
   *     assert.isNotEmpty(new Set([5, 6]));
   *     assert.isNotEmpty({ key: 7 });
   *
   * @name isNotEmpty
   * @alias notEmpty
   * @param {Object|Array|String|Map|Set} target
   * @param {String} message _optional_
   * @namespace Assert
   * @api public
   */

  assert.isNotEmpty = function(val, msg) {
    new Assertion(val, msg, assert.isNotEmpty, true).to.not.be.empty;
  };

  /*!
   * Aliases.
   */

  (function alias(name, as){
    assert[as] = assert[name];
    return alias;
  })
  ('isOk', 'ok')
  ('isNotOk', 'notOk')
  ('throws', 'throw')
  ('throws', 'Throw')
  ('isExtensible', 'extensible')
  ('isNotExtensible', 'notExtensible')
  ('isSealed', 'sealed')
  ('isNotSealed', 'notSealed')
  ('isFrozen', 'frozen')
  ('isNotFrozen', 'notFrozen')
  ('isEmpty', 'empty')
  ('isNotEmpty', 'notEmpty');
};

},{}],9:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  chai.expect = function (val, message) {
    return new chai.Assertion(val, message);
  };

  /**
   * ### .fail([message])
   * ### .fail(actual, expected, [message], [operator])
   *
   * Throw a failure.
   *
   *     expect.fail();
   *     expect.fail("custom error message");
   *     expect.fail(1, 2);
   *     expect.fail(1, 2, "custom error message");
   *     expect.fail(1, 2, "custom error message", ">");
   *     expect.fail(1, 2, undefined, ">");
   *
   * @name fail
   * @param {Mixed} actual
   * @param {Mixed} expected
   * @param {String} message
   * @param {String} operator
   * @namespace BDD
   * @api public
   */

  chai.expect.fail = function (actual, expected, message, operator) {
    if (arguments.length < 2) {
        message = actual;
        actual = undefined;
    }

    message = message || 'expect.fail()';
    throw new chai.AssertionError(message, {
        actual: actual
      , expected: expected
      , operator: operator
    }, chai.expect.fail);
  };
};

},{}],10:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

module.exports = function (chai, util) {
  var Assertion = chai.Assertion;

  function loadShould () {
    // explicitly define this method as function as to have it's name to include as `ssfi`
    function shouldGetter() {
      if (this instanceof String
          || this instanceof Number
          || this instanceof Boolean
          || typeof Symbol === 'function' && this instanceof Symbol) {
        return new Assertion(this.valueOf(), null, shouldGetter);
      }
      return new Assertion(this, null, shouldGetter);
    }
    function shouldSetter(value) {
      // See https://github.com/chaijs/chai/issues/86: this makes
      // `whatever.should = someValue` actually set `someValue`, which is
      // especially useful for `global.should = require('chai').should()`.
      //
      // Note that we have to use [[DefineProperty]] instead of [[Put]]
      // since otherwise we would trigger this very setter!
      Object.defineProperty(this, 'should', {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    }
    // modify Object.prototype to have `should`
    Object.defineProperty(Object.prototype, 'should', {
      set: shouldSetter
      , get: shouldGetter
      , configurable: true
    });

    var should = {};

    /**
     * ### .fail([message])
     * ### .fail(actual, expected, [message], [operator])
     *
     * Throw a failure.
     *
     *     should.fail();
     *     should.fail("custom error message");
     *     should.fail(1, 2);
     *     should.fail(1, 2, "custom error message");
     *     should.fail(1, 2, "custom error message", ">");
     *     should.fail(1, 2, undefined, ">");
     *
     *
     * @name fail
     * @param {Mixed} actual
     * @param {Mixed} expected
     * @param {String} message
     * @param {String} operator
     * @namespace BDD
     * @api public
     */

    should.fail = function (actual, expected, message, operator) {
      if (arguments.length < 2) {
          message = actual;
          actual = undefined;
      }

      message = message || 'should.fail()';
      throw new chai.AssertionError(message, {
          actual: actual
        , expected: expected
        , operator: operator
      }, should.fail);
    };

    /**
     * ### .equal(actual, expected, [message])
     *
     * Asserts non-strict equality (`==`) of `actual` and `expected`.
     *
     *     should.equal(3, '3', '== coerces values to strings');
     *
     * @name equal
     * @param {Mixed} actual
     * @param {Mixed} expected
     * @param {String} message
     * @namespace Should
     * @api public
     */

    should.equal = function (val1, val2, msg) {
      new Assertion(val1, msg).to.equal(val2);
    };

    /**
     * ### .throw(function, [constructor/string/regexp], [string/regexp], [message])
     *
     * Asserts that `function` will throw an error that is an instance of
     * `constructor`, or alternately that it will throw an error with message
     * matching `regexp`.
     *
     *     should.throw(fn, 'function throws a reference error');
     *     should.throw(fn, /function throws a reference error/);
     *     should.throw(fn, ReferenceError);
     *     should.throw(fn, ReferenceError, 'function throws a reference error');
     *     should.throw(fn, ReferenceError, /function throws a reference error/);
     *
     * @name throw
     * @alias Throw
     * @param {Function} function
     * @param {ErrorConstructor} constructor
     * @param {RegExp} regexp
     * @param {String} message
     * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
     * @namespace Should
     * @api public
     */

    should.Throw = function (fn, errt, errs, msg) {
      new Assertion(fn, msg).to.Throw(errt, errs);
    };

    /**
     * ### .exist
     *
     * Asserts that the target is neither `null` nor `undefined`.
     *
     *     var foo = 'hi';
     *
     *     should.exist(foo, 'foo exists');
     *
     * @name exist
     * @namespace Should
     * @api public
     */

    should.exist = function (val, msg) {
      new Assertion(val, msg).to.exist;
    }

    // negation
    should.not = {}

    /**
     * ### .not.equal(actual, expected, [message])
     *
     * Asserts non-strict inequality (`!=`) of `actual` and `expected`.
     *
     *     should.not.equal(3, 4, 'these numbers are not equal');
     *
     * @name not.equal
     * @param {Mixed} actual
     * @param {Mixed} expected
     * @param {String} message
     * @namespace Should
     * @api public
     */

    should.not.equal = function (val1, val2, msg) {
      new Assertion(val1, msg).to.not.equal(val2);
    };

    /**
     * ### .throw(function, [constructor/regexp], [message])
     *
     * Asserts that `function` will _not_ throw an error that is an instance of
     * `constructor`, or alternately that it will not throw an error with message
     * matching `regexp`.
     *
     *     should.not.throw(fn, Error, 'function does not throw');
     *
     * @name not.throw
     * @alias not.Throw
     * @param {Function} function
     * @param {ErrorConstructor} constructor
     * @param {RegExp} regexp
     * @param {String} message
     * @see https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Error#Error_types
     * @namespace Should
     * @api public
     */

    should.not.Throw = function (fn, errt, errs, msg) {
      new Assertion(fn, msg).to.not.Throw(errt, errs);
    };

    /**
     * ### .not.exist
     *
     * Asserts that the target is neither `null` nor `undefined`.
     *
     *     var bar = null;
     *
     *     should.not.exist(bar, 'bar does not exist');
     *
     * @name not.exist
     * @namespace Should
     * @api public
     */

    should.not.exist = function (val, msg) {
      new Assertion(val, msg).to.not.exist;
    }

    should['throw'] = should['Throw'];
    should.not['throw'] = should.not['Throw'];

    return should;
  };

  chai.should = loadShould;
  chai.Should = loadShould;
};

},{}],11:[function(require,module,exports){
/*!
 * Chai - addChainingMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var addLengthGuard = require('./addLengthGuard');
var chai = require('../../chai');
var flag = require('./flag');
var proxify = require('./proxify');
var transferFlags = require('./transferFlags');

/*!
 * Module variables
 */

// Check whether `Object.setPrototypeOf` is supported
var canSetPrototype = typeof Object.setPrototypeOf === 'function';

// Without `Object.setPrototypeOf` support, this module will need to add properties to a function.
// However, some of functions' own props are not configurable and should be skipped.
var testFn = function() {};
var excludeNames = Object.getOwnPropertyNames(testFn).filter(function(name) {
  var propDesc = Object.getOwnPropertyDescriptor(testFn, name);

  // Note: PhantomJS 1.x includes `callee` as one of `testFn`'s own properties,
  // but then returns `undefined` as the property descriptor for `callee`. As a
  // workaround, we perform an otherwise unnecessary type-check for `propDesc`,
  // and then filter it out if it's not an object as it should be.
  if (typeof propDesc !== 'object')
    return true;

  return !propDesc.configurable;
});

// Cache `Function` properties
var call  = Function.prototype.call,
    apply = Function.prototype.apply;

/**
 * ### .addChainableMethod(ctx, name, method, chainingBehavior)
 *
 * Adds a method to an object, such that the method can also be chained.
 *
 *     utils.addChainableMethod(chai.Assertion.prototype, 'foo', function (str) {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.equal(str);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addChainableMethod('foo', fn, chainingBehavior);
 *
 * The result can then be used as both a method assertion, executing both `method` and
 * `chainingBehavior`, or as a language chain, which only executes `chainingBehavior`.
 *
 *     expect(fooStr).to.be.foo('bar');
 *     expect(fooStr).to.be.foo.equal('foo');
 *
 * @param {Object} ctx object to which the method is added
 * @param {String} name of method to add
 * @param {Function} method function to be used for `name`, when called
 * @param {Function} chainingBehavior function to be called every time the property is accessed
 * @namespace Utils
 * @name addChainableMethod
 * @api public
 */

module.exports = function addChainableMethod(ctx, name, method, chainingBehavior) {
  if (typeof chainingBehavior !== 'function') {
    chainingBehavior = function () { };
  }

  var chainableBehavior = {
      method: method
    , chainingBehavior: chainingBehavior
  };

  // save the methods so we can overwrite them later, if we need to.
  if (!ctx.__methods) {
    ctx.__methods = {};
  }
  ctx.__methods[name] = chainableBehavior;

  Object.defineProperty(ctx, name,
    { get: function chainableMethodGetter() {
        chainableBehavior.chainingBehavior.call(this);

        var chainableMethodWrapper = function () {
          // Setting the `ssfi` flag to `chainableMethodWrapper` causes this
          // function to be the starting point for removing implementation
          // frames from the stack trace of a failed assertion.
          //
          // However, we only want to use this function as the starting point if
          // the `lockSsfi` flag isn't set.
          //
          // If the `lockSsfi` flag is set, then this assertion is being
          // invoked from inside of another assertion. In this case, the `ssfi`
          // flag has already been set by the outer assertion.
          //
          // Note that overwriting a chainable method merely replaces the saved
          // methods in `ctx.__methods` instead of completely replacing the
          // overwritten assertion. Therefore, an overwriting assertion won't
          // set the `ssfi` or `lockSsfi` flags.
          if (!flag(this, 'lockSsfi')) {
            flag(this, 'ssfi', chainableMethodWrapper);
          }

          var result = chainableBehavior.method.apply(this, arguments);
          if (result !== undefined) {
            return result;
          }

          var newAssertion = new chai.Assertion();
          transferFlags(this, newAssertion);
          return newAssertion;
        };

        addLengthGuard(chainableMethodWrapper, name, true);

        // Use `Object.setPrototypeOf` if available
        if (canSetPrototype) {
          // Inherit all properties from the object by replacing the `Function` prototype
          var prototype = Object.create(this);
          // Restore the `call` and `apply` methods from `Function`
          prototype.call = call;
          prototype.apply = apply;
          Object.setPrototypeOf(chainableMethodWrapper, prototype);
        }
        // Otherwise, redefine all properties (slow!)
        else {
          var asserterNames = Object.getOwnPropertyNames(ctx);
          asserterNames.forEach(function (asserterName) {
            if (excludeNames.indexOf(asserterName) !== -1) {
              return;
            }

            var pd = Object.getOwnPropertyDescriptor(ctx, asserterName);
            Object.defineProperty(chainableMethodWrapper, asserterName, pd);
          });
        }

        transferFlags(this, chainableMethodWrapper);
        return proxify(chainableMethodWrapper);
      }
    , configurable: true
  });
};

},{"../../chai":4,"./addLengthGuard":12,"./flag":17,"./proxify":32,"./transferFlags":34}],12:[function(require,module,exports){
var fnLengthDesc = Object.getOwnPropertyDescriptor(function () {}, 'length');

/*!
 * Chai - addLengthGuard utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .addLengthGuard(fn, assertionName, isChainable)
 *
 * Define `length` as a getter on the given uninvoked method assertion. The
 * getter acts as a guard against chaining `length` directly off of an uninvoked
 * method assertion, which is a problem because it references `function`'s
 * built-in `length` property instead of Chai's `length` assertion. When the
 * getter catches the user making this mistake, it throws an error with a
 * helpful message.
 *
 * There are two ways in which this mistake can be made. The first way is by
 * chaining the `length` assertion directly off of an uninvoked chainable
 * method. In this case, Chai suggests that the user use `lengthOf` instead. The
 * second way is by chaining the `length` assertion directly off of an uninvoked
 * non-chainable method. Non-chainable methods must be invoked prior to
 * chaining. In this case, Chai suggests that the user consult the docs for the
 * given assertion.
 *
 * If the `length` property of functions is unconfigurable, then return `fn`
 * without modification.
 *
 * Note that in ES6, the function's `length` property is configurable, so once
 * support for legacy environments is dropped, Chai's `length` property can
 * replace the built-in function's `length` property, and this length guard will
 * no longer be necessary. In the mean time, maintaining consistency across all
 * environments is the priority.
 *
 * @param {Function} fn
 * @param {String} assertionName
 * @param {Boolean} isChainable
 * @namespace Utils
 * @name addLengthGuard
 */

module.exports = function addLengthGuard (fn, assertionName, isChainable) {
  if (!fnLengthDesc.configurable) return fn;

  Object.defineProperty(fn, 'length', {
    get: function () {
      if (isChainable) {
        throw Error('Invalid Chai property: ' + assertionName + '.length. Due' +
          ' to a compatibility issue, "length" cannot directly follow "' +
          assertionName + '". Use "' + assertionName + '.lengthOf" instead.');
      }

      throw Error('Invalid Chai property: ' + assertionName + '.length. See' +
        ' docs for proper usage of "' + assertionName + '".');
    }
  });

  return fn;
};

},{}],13:[function(require,module,exports){
/*!
 * Chai - addMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var addLengthGuard = require('./addLengthGuard');
var chai = require('../../chai');
var flag = require('./flag');
var proxify = require('./proxify');
var transferFlags = require('./transferFlags');

/**
 * ### .addMethod(ctx, name, method)
 *
 * Adds a method to the prototype of an object.
 *
 *     utils.addMethod(chai.Assertion.prototype, 'foo', function (str) {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.equal(str);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addMethod('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(fooStr).to.be.foo('bar');
 *
 * @param {Object} ctx object to which the method is added
 * @param {String} name of method to add
 * @param {Function} method function to be used for name
 * @namespace Utils
 * @name addMethod
 * @api public
 */

module.exports = function addMethod(ctx, name, method) {
  var methodWrapper = function () {
    // Setting the `ssfi` flag to `methodWrapper` causes this function to be the
    // starting point for removing implementation frames from the stack trace of
    // a failed assertion.
    //
    // However, we only want to use this function as the starting point if the
    // `lockSsfi` flag isn't set.
    //
    // If the `lockSsfi` flag is set, then either this assertion has been
    // overwritten by another assertion, or this assertion is being invoked from
    // inside of another assertion. In the first case, the `ssfi` flag has
    // already been set by the overwriting assertion. In the second case, the
    // `ssfi` flag has already been set by the outer assertion.
    if (!flag(this, 'lockSsfi')) {
      flag(this, 'ssfi', methodWrapper);
    }

    var result = method.apply(this, arguments);
    if (result !== undefined)
      return result;

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  };

  addLengthGuard(methodWrapper, name, false);
  ctx[name] = proxify(methodWrapper, name);
};

},{"../../chai":4,"./addLengthGuard":12,"./flag":17,"./proxify":32,"./transferFlags":34}],14:[function(require,module,exports){
/*!
 * Chai - addProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var chai = require('../../chai');
var flag = require('./flag');
var isProxyEnabled = require('./isProxyEnabled');
var transferFlags = require('./transferFlags');

/**
 * ### .addProperty(ctx, name, getter)
 *
 * Adds a property to the prototype of an object.
 *
 *     utils.addProperty(chai.Assertion.prototype, 'foo', function () {
 *       var obj = utils.flag(this, 'object');
 *       new chai.Assertion(obj).to.be.instanceof(Foo);
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.addProperty('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.be.foo;
 *
 * @param {Object} ctx object to which the property is added
 * @param {String} name of property to add
 * @param {Function} getter function to be used for name
 * @namespace Utils
 * @name addProperty
 * @api public
 */

module.exports = function addProperty(ctx, name, getter) {
  getter = getter === undefined ? function () {} : getter;

  Object.defineProperty(ctx, name,
    { get: function propertyGetter() {
        // Setting the `ssfi` flag to `propertyGetter` causes this function to
        // be the starting point for removing implementation frames from the
        // stack trace of a failed assertion.
        //
        // However, we only want to use this function as the starting point if
        // the `lockSsfi` flag isn't set and proxy protection is disabled.
        //
        // If the `lockSsfi` flag is set, then either this assertion has been
        // overwritten by another assertion, or this assertion is being invoked
        // from inside of another assertion. In the first case, the `ssfi` flag
        // has already been set by the overwriting assertion. In the second
        // case, the `ssfi` flag has already been set by the outer assertion.
        //
        // If proxy protection is enabled, then the `ssfi` flag has already been
        // set by the proxy getter.
        if (!isProxyEnabled() && !flag(this, 'lockSsfi')) {
          flag(this, 'ssfi', propertyGetter);
        }

        var result = getter.call(this);
        if (result !== undefined)
          return result;

        var newAssertion = new chai.Assertion();
        transferFlags(this, newAssertion);
        return newAssertion;
      }
    , configurable: true
  });
};

},{"../../chai":4,"./flag":17,"./isProxyEnabled":27,"./transferFlags":34}],15:[function(require,module,exports){
/*!
 * Chai - compareByInspect utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var inspect = require('./inspect');

/**
 * ### .compareByInspect(mixed, mixed)
 *
 * To be used as a compareFunction with Array.prototype.sort. Compares elements
 * using inspect instead of default behavior of using toString so that Symbols
 * and objects with irregular/missing toString can still be sorted without a
 * TypeError.
 *
 * @param {Mixed} first element to compare
 * @param {Mixed} second element to compare
 * @returns {Number} -1 if 'a' should come before 'b'; otherwise 1
 * @name compareByInspect
 * @namespace Utils
 * @api public
 */

module.exports = function compareByInspect(a, b) {
  return inspect(a) < inspect(b) ? -1 : 1;
};

},{"./inspect":25}],16:[function(require,module,exports){
/*!
 * Chai - expectTypes utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .expectTypes(obj, types)
 *
 * Ensures that the object being tested against is of a valid type.
 *
 *     utils.expectTypes(this, ['array', 'object', 'string']);
 *
 * @param {Mixed} obj constructed Assertion
 * @param {Array} type A list of allowed types for this assertion
 * @namespace Utils
 * @name expectTypes
 * @api public
 */

var AssertionError = require('assertion-error');
var flag = require('./flag');
var type = require('type-detect');

module.exports = function expectTypes(obj, types) {
  var flagMsg = flag(obj, 'message');
  var ssfi = flag(obj, 'ssfi');

  flagMsg = flagMsg ? flagMsg + ': ' : '';

  obj = flag(obj, 'object');
  types = types.map(function (t) { return t.toLowerCase(); });
  types.sort();

  // Transforms ['lorem', 'ipsum'] into 'a lorem, or an ipsum'
  var str = types.map(function (t, index) {
    var art = ~[ 'a', 'e', 'i', 'o', 'u' ].indexOf(t.charAt(0)) ? 'an' : 'a';
    var or = types.length > 1 && index === types.length - 1 ? 'or ' : '';
    return or + art + ' ' + t;
  }).join(', ');

  var objType = type(obj).toLowerCase();

  if (!types.some(function (expected) { return objType === expected; })) {
    throw new AssertionError(
      flagMsg + 'object tested must be ' + str + ', but ' + objType + ' given',
      undefined,
      ssfi
    );
  }
};

},{"./flag":17,"assertion-error":1,"type-detect":40}],17:[function(require,module,exports){
/*!
 * Chai - flag utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .flag(object, key, [value])
 *
 * Get or set a flag value on an object. If a
 * value is provided it will be set, else it will
 * return the currently set value or `undefined` if
 * the value is not set.
 *
 *     utils.flag(this, 'foo', 'bar'); // setter
 *     utils.flag(this, 'foo'); // getter, returns `bar`
 *
 * @param {Object} object constructed Assertion
 * @param {String} key
 * @param {Mixed} value (optional)
 * @namespace Utils
 * @name flag
 * @api private
 */

module.exports = function flag(obj, key, value) {
  var flags = obj.__flags || (obj.__flags = Object.create(null));
  if (arguments.length === 3) {
    flags[key] = value;
  } else {
    return flags[key];
  }
};

},{}],18:[function(require,module,exports){
/*!
 * Chai - getActual utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getActual(object, [actual])
 *
 * Returns the `actual` value for an Assertion.
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name getActual
 */

module.exports = function getActual(obj, args) {
  return args.length > 4 ? args[4] : obj._obj;
};

},{}],19:[function(require,module,exports){
/*!
 * Chai - getEnumerableProperties utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getEnumerableProperties(object)
 *
 * This allows the retrieval of enumerable property names of an object,
 * inherited or not.
 *
 * @param {Object} object
 * @returns {Array}
 * @namespace Utils
 * @name getEnumerableProperties
 * @api public
 */

module.exports = function getEnumerableProperties(object) {
  var result = [];
  for (var name in object) {
    result.push(name);
  }
  return result;
};

},{}],20:[function(require,module,exports){
/*!
 * Chai - message composition utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var flag = require('./flag')
  , getActual = require('./getActual')
  , objDisplay = require('./objDisplay');

/**
 * ### .getMessage(object, message, negateMessage)
 *
 * Construct the error message based on flags
 * and template tags. Template tags will return
 * a stringified inspection of the object referenced.
 *
 * Message template tags:
 * - `#{this}` current asserted object
 * - `#{act}` actual value
 * - `#{exp}` expected value
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name getMessage
 * @api public
 */

module.exports = function getMessage(obj, args) {
  var negate = flag(obj, 'negate')
    , val = flag(obj, 'object')
    , expected = args[3]
    , actual = getActual(obj, args)
    , msg = negate ? args[2] : args[1]
    , flagMsg = flag(obj, 'message');

  if(typeof msg === "function") msg = msg();
  msg = msg || '';
  msg = msg
    .replace(/#\{this\}/g, function () { return objDisplay(val); })
    .replace(/#\{act\}/g, function () { return objDisplay(actual); })
    .replace(/#\{exp\}/g, function () { return objDisplay(expected); });

  return flagMsg ? flagMsg + ': ' + msg : msg;
};

},{"./flag":17,"./getActual":18,"./objDisplay":28}],21:[function(require,module,exports){
/*!
 * Chai - getOwnEnumerableProperties utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var getOwnEnumerablePropertySymbols = require('./getOwnEnumerablePropertySymbols');

/**
 * ### .getOwnEnumerableProperties(object)
 *
 * This allows the retrieval of directly-owned enumerable property names and
 * symbols of an object. This function is necessary because Object.keys only
 * returns enumerable property names, not enumerable property symbols.
 *
 * @param {Object} object
 * @returns {Array}
 * @namespace Utils
 * @name getOwnEnumerableProperties
 * @api public
 */

module.exports = function getOwnEnumerableProperties(obj) {
  return Object.keys(obj).concat(getOwnEnumerablePropertySymbols(obj));
};

},{"./getOwnEnumerablePropertySymbols":22}],22:[function(require,module,exports){
/*!
 * Chai - getOwnEnumerablePropertySymbols utility
 * Copyright(c) 2011-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getOwnEnumerablePropertySymbols(object)
 *
 * This allows the retrieval of directly-owned enumerable property symbols of an
 * object. This function is necessary because Object.getOwnPropertySymbols
 * returns both enumerable and non-enumerable property symbols.
 *
 * @param {Object} object
 * @returns {Array}
 * @namespace Utils
 * @name getOwnEnumerablePropertySymbols
 * @api public
 */

module.exports = function getOwnEnumerablePropertySymbols(obj) {
  if (typeof Object.getOwnPropertySymbols !== 'function') return [];

  return Object.getOwnPropertySymbols(obj).filter(function (sym) {
    return Object.getOwnPropertyDescriptor(obj, sym).enumerable;
  });
};

},{}],23:[function(require,module,exports){
/*!
 * Chai - getProperties utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getProperties(object)
 *
 * This allows the retrieval of property names of an object, enumerable or not,
 * inherited or not.
 *
 * @param {Object} object
 * @returns {Array}
 * @namespace Utils
 * @name getProperties
 * @api public
 */

module.exports = function getProperties(object) {
  var result = Object.getOwnPropertyNames(object);

  function addProperty(property) {
    if (result.indexOf(property) === -1) {
      result.push(property);
    }
  }

  var proto = Object.getPrototypeOf(object);
  while (proto !== null) {
    Object.getOwnPropertyNames(proto).forEach(addProperty);
    proto = Object.getPrototypeOf(proto);
  }

  return result;
};

},{}],24:[function(require,module,exports){
/*!
 * chai
 * Copyright(c) 2011 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Dependencies that are used for multiple exports are required here only once
 */

var pathval = require('pathval');

/*!
 * test utility
 */

exports.test = require('./test');

/*!
 * type utility
 */

exports.type = require('type-detect');

/*!
 * expectTypes utility
 */
exports.expectTypes = require('./expectTypes');

/*!
 * message utility
 */

exports.getMessage = require('./getMessage');

/*!
 * actual utility
 */

exports.getActual = require('./getActual');

/*!
 * Inspect util
 */

exports.inspect = require('./inspect');

/*!
 * Object Display util
 */

exports.objDisplay = require('./objDisplay');

/*!
 * Flag utility
 */

exports.flag = require('./flag');

/*!
 * Flag transferring utility
 */

exports.transferFlags = require('./transferFlags');

/*!
 * Deep equal utility
 */

exports.eql = require('deep-eql');

/*!
 * Deep path info
 */

exports.getPathInfo = pathval.getPathInfo;

/*!
 * Check if a property exists
 */

exports.hasProperty = pathval.hasProperty;

/*!
 * Function name
 */

exports.getName = require('get-func-name');

/*!
 * add Property
 */

exports.addProperty = require('./addProperty');

/*!
 * add Method
 */

exports.addMethod = require('./addMethod');

/*!
 * overwrite Property
 */

exports.overwriteProperty = require('./overwriteProperty');

/*!
 * overwrite Method
 */

exports.overwriteMethod = require('./overwriteMethod');

/*!
 * Add a chainable method
 */

exports.addChainableMethod = require('./addChainableMethod');

/*!
 * Overwrite chainable method
 */

exports.overwriteChainableMethod = require('./overwriteChainableMethod');

/*!
 * Compare by inspect method
 */

exports.compareByInspect = require('./compareByInspect');

/*!
 * Get own enumerable property symbols method
 */

exports.getOwnEnumerablePropertySymbols = require('./getOwnEnumerablePropertySymbols');

/*!
 * Get own enumerable properties method
 */

exports.getOwnEnumerableProperties = require('./getOwnEnumerableProperties');

/*!
 * Checks error against a given set of criteria
 */

exports.checkError = require('check-error');

/*!
 * Proxify util
 */

exports.proxify = require('./proxify');

/*!
 * addLengthGuard util
 */

exports.addLengthGuard = require('./addLengthGuard');

/*!
 * isProxyEnabled helper
 */

exports.isProxyEnabled = require('./isProxyEnabled');

/*!
 * isNaN method
 */

exports.isNaN = require('./isNaN');

},{"./addChainableMethod":11,"./addLengthGuard":12,"./addMethod":13,"./addProperty":14,"./compareByInspect":15,"./expectTypes":16,"./flag":17,"./getActual":18,"./getMessage":20,"./getOwnEnumerableProperties":21,"./getOwnEnumerablePropertySymbols":22,"./inspect":25,"./isNaN":26,"./isProxyEnabled":27,"./objDisplay":28,"./overwriteChainableMethod":29,"./overwriteMethod":30,"./overwriteProperty":31,"./proxify":32,"./test":33,"./transferFlags":34,"check-error":35,"deep-eql":36,"get-func-name":37,"pathval":39,"type-detect":40}],25:[function(require,module,exports){
// This is (almost) directly from Node.js utils
// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/util.js

var getName = require('get-func-name');
var getProperties = require('./getProperties');
var getEnumerableProperties = require('./getEnumerableProperties');
var config = require('../config');

module.exports = inspect;

/**
 * ### .inspect(obj, [showHidden], [depth], [colors])
 *
 * Echoes the value of a value. Tries to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Boolean} showHidden Flag that shows hidden (not enumerable)
 *    properties of objects. Default is false.
 * @param {Number} depth Depth in which to descend in object. Default is 2.
 * @param {Boolean} colors Flag to turn on ANSI escape codes to color the
 *    output. Default is false (no coloring).
 * @namespace Utils
 * @name inspect
 */
function inspect(obj, showHidden, depth, colors) {
  var ctx = {
    showHidden: showHidden,
    seen: [],
    stylize: function (str) { return str; }
  };
  return formatValue(ctx, obj, (typeof depth === 'undefined' ? 2 : depth));
}

// Returns true if object is a DOM element.
var isDOMElement = function (object) {
  if (typeof HTMLElement === 'object') {
    return object instanceof HTMLElement;
  } else {
    return object &&
      typeof object === 'object' &&
      'nodeType' in object &&
      object.nodeType === 1 &&
      typeof object.nodeName === 'string';
  }
};

function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (value && typeof value.inspect === 'function' &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (typeof ret !== 'string') {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // If this is a DOM element, try to get the outer HTML.
  if (isDOMElement(value)) {
    if ('outerHTML' in value) {
      return value.outerHTML;
      // This value does not have an outerHTML attribute,
      //   it could still be an XML element
    } else {
      // Attempt to serialize it
      try {
        if (document.xmlVersion) {
          var xmlSerializer = new XMLSerializer();
          return xmlSerializer.serializeToString(value);
        } else {
          // Firefox 11- do not support outerHTML
          //   It does, however, support innerHTML
          //   Use the following to render the element
          var ns = "http://www.w3.org/1999/xhtml";
          var container = document.createElementNS(ns, '_');

          container.appendChild(value.cloneNode(false));
          var html = container.innerHTML
            .replace('><', '>' + value.innerHTML + '<');
          container.innerHTML = '';
          return html;
        }
      } catch (err) {
        // This could be a non-native DOM implementation,
        //   continue with the normal flow:
        //   printing the element as if it is an object.
      }
    }
  }

  // Look up the keys of the object.
  var visibleKeys = getEnumerableProperties(value);
  var keys = ctx.showHidden ? getProperties(value) : visibleKeys;

  var name, nameSuffix;

  // Some type of object without properties can be shortcut.
  // In IE, errors have a single `stack` property, or if they are vanilla `Error`,
  // a `stack` plus `description` property; ignore those for consistency.
  if (keys.length === 0 || (isError(value) && (
      (keys.length === 1 && keys[0] === 'stack') ||
      (keys.length === 2 && keys[0] === 'description' && keys[1] === 'stack')
     ))) {
    if (typeof value === 'function') {
      name = getName(value);
      nameSuffix = name ? ': ' + name : '';
      return ctx.stylize('[Function' + nameSuffix + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toUTCString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = ''
    , array = false
    , typedArray = false
    , braces = ['{', '}'];

  if (isTypedArray(value)) {
    typedArray = true;
    braces = ['[', ']'];
  }

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (typeof value === 'function') {
    name = getName(value);
    nameSuffix = name ? ': ' + name : '';
    base = ' [Function' + nameSuffix + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    return formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else if (typedArray) {
    return formatTypedArray(value);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}

function formatPrimitive(ctx, value) {
  switch (typeof value) {
    case 'undefined':
      return ctx.stylize('undefined', 'undefined');

    case 'string':
      var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                               .replace(/'/g, "\\'")
                                               .replace(/\\"/g, '"') + '\'';
      return ctx.stylize(simple, 'string');

    case 'number':
      if (value === 0 && (1/value) === -Infinity) {
        return ctx.stylize('-0', 'number');
      }
      return ctx.stylize('' + value, 'number');

    case 'boolean':
      return ctx.stylize('' + value, 'boolean');

    case 'symbol':
      return ctx.stylize(value.toString(), 'symbol');
  }
  // For some reason typeof null is "object", so special case here.
  if (value === null) {
    return ctx.stylize('null', 'null');
  }
}

function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}

function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (Object.prototype.hasOwnProperty.call(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }

  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}

function formatTypedArray(value) {
  var str = '[ ';

  for (var i = 0; i < value.length; ++i) {
    if (str.length >= config.truncateThreshold - 7) {
      str += '...';
      break;
    }
    str += value[i] + ', ';
  }
  str += ' ]';

  // Removing trailing `, ` if the array was not truncated
  if (str.indexOf(',  ]') !== -1) {
    str = str.replace(',  ]', ' ]');
  }

  return str;
}

function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name;
  var propDescriptor = Object.getOwnPropertyDescriptor(value, key);
  var str;

  if (propDescriptor) {
    if (propDescriptor.get) {
      if (propDescriptor.set) {
        str = ctx.stylize('[Getter/Setter]', 'special');
      } else {
        str = ctx.stylize('[Getter]', 'special');
      }
    } else {
      if (propDescriptor.set) {
        str = ctx.stylize('[Setter]', 'special');
      }
    }
  }
  if (visibleKeys.indexOf(key) < 0) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(value[key]) < 0) {
      if (recurseTimes === null) {
        str = formatValue(ctx, value[key], null);
      } else {
        str = formatValue(ctx, value[key], recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (typeof name === 'undefined') {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}

function reduceToSingleString(output, base, braces) {
  var length = output.reduce(function(prev, cur) {
    return prev + cur.length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}

function isTypedArray(ar) {
  // Unfortunately there's no way to check if an object is a TypedArray
  // We have to check if it's one of these types
  return (typeof ar === 'object' && /\w+Array]$/.test(objectToString(ar)));
}

function isArray(ar) {
  return Array.isArray(ar) ||
         (typeof ar === 'object' && objectToString(ar) === '[object Array]');
}

function isRegExp(re) {
  return typeof re === 'object' && objectToString(re) === '[object RegExp]';
}

function isDate(d) {
  return typeof d === 'object' && objectToString(d) === '[object Date]';
}

function isError(e) {
  return typeof e === 'object' && objectToString(e) === '[object Error]';
}

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

},{"../config":6,"./getEnumerableProperties":19,"./getProperties":23,"get-func-name":37}],26:[function(require,module,exports){
/*!
 * Chai - isNaN utility
 * Copyright(c) 2012-2015 Sakthipriyan Vairamani <thechargingvolcano@gmail.com>
 * MIT Licensed
 */

/**
 * ### .isNaN(value)
 *
 * Checks if the given value is NaN or not.
 *
 *     utils.isNaN(NaN); // true
 *
 * @param {Value} The value which has to be checked if it is NaN
 * @name isNaN
 * @api private
 */

function isNaN(value) {
  // Refer http://www.ecma-international.org/ecma-262/6.0/#sec-isnan-number
  // section's NOTE.
  return value !== value;
}

// If ECMAScript 6's Number.isNaN is present, prefer that.
module.exports = Number.isNaN || isNaN;

},{}],27:[function(require,module,exports){
var config = require('../config');

/*!
 * Chai - isProxyEnabled helper
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .isProxyEnabled()
 *
 * Helper function to check if Chai's proxy protection feature is enabled. If
 * proxies are unsupported or disabled via the user's Chai config, then return
 * false. Otherwise, return true.
 *
 * @namespace Utils
 * @name isProxyEnabled
 */

module.exports = function isProxyEnabled() {
  return config.useProxy &&
    typeof Proxy !== 'undefined' &&
    typeof Reflect !== 'undefined';
};

},{"../config":6}],28:[function(require,module,exports){
/*!
 * Chai - flag utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var inspect = require('./inspect');
var config = require('../config');

/**
 * ### .objDisplay(object)
 *
 * Determines if an object or an array matches
 * criteria to be inspected in-line for error
 * messages or should be truncated.
 *
 * @param {Mixed} javascript object to inspect
 * @name objDisplay
 * @namespace Utils
 * @api public
 */

module.exports = function objDisplay(obj) {
  var str = inspect(obj)
    , type = Object.prototype.toString.call(obj);

  if (config.truncateThreshold && str.length >= config.truncateThreshold) {
    if (type === '[object Function]') {
      return !obj.name || obj.name === ''
        ? '[Function]'
        : '[Function: ' + obj.name + ']';
    } else if (type === '[object Array]') {
      return '[ Array(' + obj.length + ') ]';
    } else if (type === '[object Object]') {
      var keys = Object.keys(obj)
        , kstr = keys.length > 2
          ? keys.splice(0, 2).join(', ') + ', ...'
          : keys.join(', ');
      return '{ Object (' + kstr + ') }';
    } else {
      return str;
    }
  } else {
    return str;
  }
};

},{"../config":6,"./inspect":25}],29:[function(require,module,exports){
/*!
 * Chai - overwriteChainableMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var chai = require('../../chai');
var transferFlags = require('./transferFlags');

/**
 * ### .overwriteChainableMethod(ctx, name, method, chainingBehavior)
 *
 * Overwrites an already existing chainable method
 * and provides access to the previous function or
 * property.  Must return functions to be used for
 * name.
 *
 *     utils.overwriteChainableMethod(chai.Assertion.prototype, 'lengthOf',
 *       function (_super) {
 *       }
 *     , function (_super) {
 *       }
 *     );
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteChainableMethod('foo', fn, fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.have.lengthOf(3);
 *     expect(myFoo).to.have.lengthOf.above(3);
 *
 * @param {Object} ctx object whose method / property is to be overwritten
 * @param {String} name of method / property to overwrite
 * @param {Function} method function that returns a function to be used for name
 * @param {Function} chainingBehavior function that returns a function to be used for property
 * @namespace Utils
 * @name overwriteChainableMethod
 * @api public
 */

module.exports = function overwriteChainableMethod(ctx, name, method, chainingBehavior) {
  var chainableBehavior = ctx.__methods[name];

  var _chainingBehavior = chainableBehavior.chainingBehavior;
  chainableBehavior.chainingBehavior = function overwritingChainableMethodGetter() {
    var result = chainingBehavior(_chainingBehavior).call(this);
    if (result !== undefined) {
      return result;
    }

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  };

  var _method = chainableBehavior.method;
  chainableBehavior.method = function overwritingChainableMethodWrapper() {
    var result = method(_method).apply(this, arguments);
    if (result !== undefined) {
      return result;
    }

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  };
};

},{"../../chai":4,"./transferFlags":34}],30:[function(require,module,exports){
/*!
 * Chai - overwriteMethod utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var addLengthGuard = require('./addLengthGuard');
var chai = require('../../chai');
var flag = require('./flag');
var proxify = require('./proxify');
var transferFlags = require('./transferFlags');

/**
 * ### .overwriteMethod(ctx, name, fn)
 *
 * Overwrites an already existing method and provides
 * access to previous function. Must return function
 * to be used for name.
 *
 *     utils.overwriteMethod(chai.Assertion.prototype, 'equal', function (_super) {
 *       return function (str) {
 *         var obj = utils.flag(this, 'object');
 *         if (obj instanceof Foo) {
 *           new chai.Assertion(obj.value).to.equal(str);
 *         } else {
 *           _super.apply(this, arguments);
 *         }
 *       }
 *     });
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteMethod('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.equal('bar');
 *
 * @param {Object} ctx object whose method is to be overwritten
 * @param {String} name of method to overwrite
 * @param {Function} method function that returns a function to be used for name
 * @namespace Utils
 * @name overwriteMethod
 * @api public
 */

module.exports = function overwriteMethod(ctx, name, method) {
  var _method = ctx[name]
    , _super = function () {
      throw new Error(name + ' is not a function');
    };

  if (_method && 'function' === typeof _method)
    _super = _method;

  var overwritingMethodWrapper = function () {
    // Setting the `ssfi` flag to `overwritingMethodWrapper` causes this
    // function to be the starting point for removing implementation frames from
    // the stack trace of a failed assertion.
    //
    // However, we only want to use this function as the starting point if the
    // `lockSsfi` flag isn't set.
    //
    // If the `lockSsfi` flag is set, then either this assertion has been
    // overwritten by another assertion, or this assertion is being invoked from
    // inside of another assertion. In the first case, the `ssfi` flag has
    // already been set by the overwriting assertion. In the second case, the
    // `ssfi` flag has already been set by the outer assertion.
    if (!flag(this, 'lockSsfi')) {
      flag(this, 'ssfi', overwritingMethodWrapper);
    }

    // Setting the `lockSsfi` flag to `true` prevents the overwritten assertion
    // from changing the `ssfi` flag. By this point, the `ssfi` flag is already
    // set to the correct starting point for this assertion.
    var origLockSsfi = flag(this, 'lockSsfi');
    flag(this, 'lockSsfi', true);
    var result = method(_super).apply(this, arguments);
    flag(this, 'lockSsfi', origLockSsfi);

    if (result !== undefined) {
      return result;
    }

    var newAssertion = new chai.Assertion();
    transferFlags(this, newAssertion);
    return newAssertion;
  }

  addLengthGuard(overwritingMethodWrapper, name, false);
  ctx[name] = proxify(overwritingMethodWrapper, name);
};

},{"../../chai":4,"./addLengthGuard":12,"./flag":17,"./proxify":32,"./transferFlags":34}],31:[function(require,module,exports){
/*!
 * Chai - overwriteProperty utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var chai = require('../../chai');
var flag = require('./flag');
var isProxyEnabled = require('./isProxyEnabled');
var transferFlags = require('./transferFlags');

/**
 * ### .overwriteProperty(ctx, name, fn)
 *
 * Overwrites an already existing property getter and provides
 * access to previous value. Must return function to use as getter.
 *
 *     utils.overwriteProperty(chai.Assertion.prototype, 'ok', function (_super) {
 *       return function () {
 *         var obj = utils.flag(this, 'object');
 *         if (obj instanceof Foo) {
 *           new chai.Assertion(obj.name).to.equal('bar');
 *         } else {
 *           _super.call(this);
 *         }
 *       }
 *     });
 *
 *
 * Can also be accessed directly from `chai.Assertion`.
 *
 *     chai.Assertion.overwriteProperty('foo', fn);
 *
 * Then can be used as any other assertion.
 *
 *     expect(myFoo).to.be.ok;
 *
 * @param {Object} ctx object whose property is to be overwritten
 * @param {String} name of property to overwrite
 * @param {Function} getter function that returns a getter function to be used for name
 * @namespace Utils
 * @name overwriteProperty
 * @api public
 */

module.exports = function overwriteProperty(ctx, name, getter) {
  var _get = Object.getOwnPropertyDescriptor(ctx, name)
    , _super = function () {};

  if (_get && 'function' === typeof _get.get)
    _super = _get.get

  Object.defineProperty(ctx, name,
    { get: function overwritingPropertyGetter() {
        // Setting the `ssfi` flag to `overwritingPropertyGetter` causes this
        // function to be the starting point for removing implementation frames
        // from the stack trace of a failed assertion.
        //
        // However, we only want to use this function as the starting point if
        // the `lockSsfi` flag isn't set and proxy protection is disabled.
        //
        // If the `lockSsfi` flag is set, then either this assertion has been
        // overwritten by another assertion, or this assertion is being invoked
        // from inside of another assertion. In the first case, the `ssfi` flag
        // has already been set by the overwriting assertion. In the second
        // case, the `ssfi` flag has already been set by the outer assertion.
        //
        // If proxy protection is enabled, then the `ssfi` flag has already been
        // set by the proxy getter.
        if (!isProxyEnabled() && !flag(this, 'lockSsfi')) {
          flag(this, 'ssfi', overwritingPropertyGetter);
        }

        // Setting the `lockSsfi` flag to `true` prevents the overwritten
        // assertion from changing the `ssfi` flag. By this point, the `ssfi`
        // flag is already set to the correct starting point for this assertion.
        var origLockSsfi = flag(this, 'lockSsfi');
        flag(this, 'lockSsfi', true);
        var result = getter(_super).call(this);
        flag(this, 'lockSsfi', origLockSsfi);

        if (result !== undefined) {
          return result;
        }

        var newAssertion = new chai.Assertion();
        transferFlags(this, newAssertion);
        return newAssertion;
      }
    , configurable: true
  });
};

},{"../../chai":4,"./flag":17,"./isProxyEnabled":27,"./transferFlags":34}],32:[function(require,module,exports){
var config = require('../config');
var flag = require('./flag');
var getProperties = require('./getProperties');
var isProxyEnabled = require('./isProxyEnabled');

/*!
 * Chai - proxify utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .proxify(object)
 *
 * Return a proxy of given object that throws an error when a non-existent
 * property is read. By default, the root cause is assumed to be a misspelled
 * property, and thus an attempt is made to offer a reasonable suggestion from
 * the list of existing properties. However, if a nonChainableMethodName is
 * provided, then the root cause is instead a failure to invoke a non-chainable
 * method prior to reading the non-existent property.
 *
 * If proxies are unsupported or disabled via the user's Chai config, then
 * return object without modification.
 *
 * @param {Object} obj
 * @param {String} nonChainableMethodName
 * @namespace Utils
 * @name proxify
 */

var builtins = ['__flags', '__methods', '_obj', 'assert'];

module.exports = function proxify(obj, nonChainableMethodName) {
  if (!isProxyEnabled()) return obj;

  return new Proxy(obj, {
    get: function proxyGetter(target, property) {
      // This check is here because we should not throw errors on Symbol properties
      // such as `Symbol.toStringTag`.
      // The values for which an error should be thrown can be configured using
      // the `config.proxyExcludedKeys` setting.
      if (typeof property === 'string' &&
          config.proxyExcludedKeys.indexOf(property) === -1 &&
          !Reflect.has(target, property)) {
        // Special message for invalid property access of non-chainable methods.
        if (nonChainableMethodName) {
          throw Error('Invalid Chai property: ' + nonChainableMethodName + '.' +
            property + '. See docs for proper usage of "' +
            nonChainableMethodName + '".');
        }

        // If the property is reasonably close to an existing Chai property,
        // suggest that property to the user. Only suggest properties with a
        // distance less than 4.
        var suggestion = null;
        var suggestionDistance = 4;
        getProperties(target).forEach(function(prop) {
          if (
            !Object.prototype.hasOwnProperty(prop) &&
            builtins.indexOf(prop) === -1
          ) {
            var dist = stringDistanceCapped(
              property,
              prop,
              suggestionDistance
            );
            if (dist < suggestionDistance) {
              suggestion = prop;
              suggestionDistance = dist;
            }
          }
        });

        if (suggestion !== null) {
          throw Error('Invalid Chai property: ' + property +
            '. Did you mean "' + suggestion + '"?');
        } else {
          throw Error('Invalid Chai property: ' + property);
        }
      }

      // Use this proxy getter as the starting point for removing implementation
      // frames from the stack trace of a failed assertion. For property
      // assertions, this prevents the proxy getter from showing up in the stack
      // trace since it's invoked before the property getter. For method and
      // chainable method assertions, this flag will end up getting changed to
      // the method wrapper, which is good since this frame will no longer be in
      // the stack once the method is invoked. Note that Chai builtin assertion
      // properties such as `__flags` are skipped since this is only meant to
      // capture the starting point of an assertion. This step is also skipped
      // if the `lockSsfi` flag is set, thus indicating that this assertion is
      // being called from within another assertion. In that case, the `ssfi`
      // flag is already set to the outer assertion's starting point.
      if (builtins.indexOf(property) === -1 && !flag(target, 'lockSsfi')) {
        flag(target, 'ssfi', proxyGetter);
      }

      return Reflect.get(target, property);
    }
  });
};

/**
 * # stringDistanceCapped(strA, strB, cap)
 * Return the Levenshtein distance between two strings, but no more than cap.
 * @param {string} strA
 * @param {string} strB
 * @param {number} number
 * @return {number} min(string distance between strA and strB, cap)
 * @api private
 */

function stringDistanceCapped(strA, strB, cap) {
  if (Math.abs(strA.length - strB.length) >= cap) {
    return cap;
  }

  var memo = [];
  // `memo` is a two-dimensional array containing distances.
  // memo[i][j] is the distance between strA.slice(0, i) and
  // strB.slice(0, j).
  for (var i = 0; i <= strA.length; i++) {
    memo[i] = Array(strB.length + 1).fill(0);
    memo[i][0] = i;
  }
  for (var j = 0; j < strB.length; j++) {
    memo[0][j] = j;
  }

  for (var i = 1; i <= strA.length; i++) {
    var ch = strA.charCodeAt(i - 1);
    for (var j = 1; j <= strB.length; j++) {
      if (Math.abs(i - j) >= cap) {
        memo[i][j] = cap;
        continue;
      }
      memo[i][j] = Math.min(
        memo[i - 1][j] + 1,
        memo[i][j - 1] + 1,
        memo[i - 1][j - 1] +
          (ch === strB.charCodeAt(j - 1) ? 0 : 1)
      );
    }
  }

  return memo[strA.length][strB.length];
}

},{"../config":6,"./flag":17,"./getProperties":23,"./isProxyEnabled":27}],33:[function(require,module,exports){
/*!
 * Chai - test utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/*!
 * Module dependencies
 */

var flag = require('./flag');

/**
 * ### .test(object, expression)
 *
 * Test and object for expression.
 *
 * @param {Object} object (constructed Assertion)
 * @param {Arguments} chai.Assertion.prototype.assert arguments
 * @namespace Utils
 * @name test
 */

module.exports = function test(obj, args) {
  var negate = flag(obj, 'negate')
    , expr = args[0];
  return negate ? !expr : expr;
};

},{"./flag":17}],34:[function(require,module,exports){
/*!
 * Chai - transferFlags utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .transferFlags(assertion, object, includeAll = true)
 *
 * Transfer all the flags for `assertion` to `object`. If
 * `includeAll` is set to `false`, then the base Chai
 * assertion flags (namely `object`, `ssfi`, `lockSsfi`,
 * and `message`) will not be transferred.
 *
 *
 *     var newAssertion = new Assertion();
 *     utils.transferFlags(assertion, newAssertion);
 *
 *     var anotherAssertion = new Assertion(myObj);
 *     utils.transferFlags(assertion, anotherAssertion, false);
 *
 * @param {Assertion} assertion the assertion to transfer the flags from
 * @param {Object} object the object to transfer the flags to; usually a new assertion
 * @param {Boolean} includeAll
 * @namespace Utils
 * @name transferFlags
 * @api private
 */

module.exports = function transferFlags(assertion, object, includeAll) {
  var flags = assertion.__flags || (assertion.__flags = Object.create(null));

  if (!object.__flags) {
    object.__flags = Object.create(null);
  }

  includeAll = arguments.length === 3 ? includeAll : true;

  for (var flag in flags) {
    if (includeAll ||
        (flag !== 'object' && flag !== 'ssfi' && flag !== 'lockSsfi' && flag != 'message')) {
      object.__flags[flag] = flags[flag];
    }
  }
};

},{}],35:[function(require,module,exports){
'use strict';

/* !
 * Chai - checkError utility
 * Copyright(c) 2012-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .checkError
 *
 * Checks that an error conforms to a given set of criteria and/or retrieves information about it.
 *
 * @api public
 */

/**
 * ### .compatibleInstance(thrown, errorLike)
 *
 * Checks if two instances are compatible (strict equal).
 * Returns false if errorLike is not an instance of Error, because instances
 * can only be compatible if they're both error instances.
 *
 * @name compatibleInstance
 * @param {Error} thrown error
 * @param {Error|ErrorConstructor} errorLike object to compare against
 * @namespace Utils
 * @api public
 */

function compatibleInstance(thrown, errorLike) {
  return errorLike instanceof Error && thrown === errorLike;
}

/**
 * ### .compatibleConstructor(thrown, errorLike)
 *
 * Checks if two constructors are compatible.
 * This function can receive either an error constructor or
 * an error instance as the `errorLike` argument.
 * Constructors are compatible if they're the same or if one is
 * an instance of another.
 *
 * @name compatibleConstructor
 * @param {Error} thrown error
 * @param {Error|ErrorConstructor} errorLike object to compare against
 * @namespace Utils
 * @api public
 */

function compatibleConstructor(thrown, errorLike) {
  if (errorLike instanceof Error) {
    // If `errorLike` is an instance of any error we compare their constructors
    return thrown.constructor === errorLike.constructor || thrown instanceof errorLike.constructor;
  } else if (errorLike.prototype instanceof Error || errorLike === Error) {
    // If `errorLike` is a constructor that inherits from Error, we compare `thrown` to `errorLike` directly
    return thrown.constructor === errorLike || thrown instanceof errorLike;
  }

  return false;
}

/**
 * ### .compatibleMessage(thrown, errMatcher)
 *
 * Checks if an error's message is compatible with a matcher (String or RegExp).
 * If the message contains the String or passes the RegExp test,
 * it is considered compatible.
 *
 * @name compatibleMessage
 * @param {Error} thrown error
 * @param {String|RegExp} errMatcher to look for into the message
 * @namespace Utils
 * @api public
 */

function compatibleMessage(thrown, errMatcher) {
  var comparisonString = typeof thrown === 'string' ? thrown : thrown.message;
  if (errMatcher instanceof RegExp) {
    return errMatcher.test(comparisonString);
  } else if (typeof errMatcher === 'string') {
    return comparisonString.indexOf(errMatcher) !== -1; // eslint-disable-line no-magic-numbers
  }

  return false;
}

/**
 * ### .getFunctionName(constructorFn)
 *
 * Returns the name of a function.
 * This also includes a polyfill function if `constructorFn.name` is not defined.
 *
 * @name getFunctionName
 * @param {Function} constructorFn
 * @namespace Utils
 * @api private
 */

var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\(\/]+)/;
function getFunctionName(constructorFn) {
  var name = '';
  if (typeof constructorFn.name === 'undefined') {
    // Here we run a polyfill if constructorFn.name is not defined
    var match = String(constructorFn).match(functionNameMatch);
    if (match) {
      name = match[1];
    }
  } else {
    name = constructorFn.name;
  }

  return name;
}

/**
 * ### .getConstructorName(errorLike)
 *
 * Gets the constructor name for an Error instance or constructor itself.
 *
 * @name getConstructorName
 * @param {Error|ErrorConstructor} errorLike
 * @namespace Utils
 * @api public
 */

function getConstructorName(errorLike) {
  var constructorName = errorLike;
  if (errorLike instanceof Error) {
    constructorName = getFunctionName(errorLike.constructor);
  } else if (typeof errorLike === 'function') {
    // If `err` is not an instance of Error it is an error constructor itself or another function.
    // If we've got a common function we get its name, otherwise we may need to create a new instance
    // of the error just in case it's a poorly-constructed error. Please see chaijs/chai/issues/45 to know more.
    constructorName = getFunctionName(errorLike).trim() ||
        getFunctionName(new errorLike()); // eslint-disable-line new-cap
  }

  return constructorName;
}

/**
 * ### .getMessage(errorLike)
 *
 * Gets the error message from an error.
 * If `err` is a String itself, we return it.
 * If the error has no message, we return an empty string.
 *
 * @name getMessage
 * @param {Error|String} errorLike
 * @namespace Utils
 * @api public
 */

function getMessage(errorLike) {
  var msg = '';
  if (errorLike && errorLike.message) {
    msg = errorLike.message;
  } else if (typeof errorLike === 'string') {
    msg = errorLike;
  }

  return msg;
}

module.exports = {
  compatibleInstance: compatibleInstance,
  compatibleConstructor: compatibleConstructor,
  compatibleMessage: compatibleMessage,
  getMessage: getMessage,
  getConstructorName: getConstructorName,
};

},{}],36:[function(require,module,exports){
'use strict';
/* globals Symbol: false, Uint8Array: false, WeakMap: false */
/*!
 * deep-eql
 * Copyright(c) 2013 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

var type = require('type-detect');
function FakeMap() {
  this._key = 'chai/deep-eql__' + Math.random() + Date.now();
}

FakeMap.prototype = {
  get: function getMap(key) {
    return key[this._key];
  },
  set: function setMap(key, value) {
    if (Object.isExtensible(key)) {
      Object.defineProperty(key, this._key, {
        value: value,
        configurable: true,
      });
    }
  },
};

var MemoizeMap = typeof WeakMap === 'function' ? WeakMap : FakeMap;
/*!
 * Check to see if the MemoizeMap has recorded a result of the two operands
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {MemoizeMap} memoizeMap
 * @returns {Boolean|null} result
*/
function memoizeCompare(leftHandOperand, rightHandOperand, memoizeMap) {
  // Technically, WeakMap keys can *only* be objects, not primitives.
  if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    return null;
  }
  var leftHandMap = memoizeMap.get(leftHandOperand);
  if (leftHandMap) {
    var result = leftHandMap.get(rightHandOperand);
    if (typeof result === 'boolean') {
      return result;
    }
  }
  return null;
}

/*!
 * Set the result of the equality into the MemoizeMap
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {MemoizeMap} memoizeMap
 * @param {Boolean} result
*/
function memoizeSet(leftHandOperand, rightHandOperand, memoizeMap, result) {
  // Technically, WeakMap keys can *only* be objects, not primitives.
  if (!memoizeMap || isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    return;
  }
  var leftHandMap = memoizeMap.get(leftHandOperand);
  if (leftHandMap) {
    leftHandMap.set(rightHandOperand, result);
  } else {
    leftHandMap = new MemoizeMap();
    leftHandMap.set(rightHandOperand, result);
    memoizeMap.set(leftHandOperand, leftHandMap);
  }
}

/*!
 * Primary Export
 */

module.exports = deepEqual;
module.exports.MemoizeMap = MemoizeMap;

/**
 * Assert deeply nested sameValue equality between two objects of any type.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (optional) Additional options
 * @param {Array} [options.comparator] (optional) Override default algorithm, determining custom equality.
 * @param {Array} [options.memoize] (optional) Provide a custom memoization object which will cache the results of
    complex objects for a speed boost. By passing `false` you can disable memoization, but this will cause circular
    references to blow the stack.
 * @return {Boolean} equal match
 */
function deepEqual(leftHandOperand, rightHandOperand, options) {
  // If we have a comparator, we can't assume anything; so bail to its check first.
  if (options && options.comparator) {
    return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
  }

  var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
  if (simpleResult !== null) {
    return simpleResult;
  }

  // Deeper comparisons are pushed through to a larger function
  return extensiveDeepEqual(leftHandOperand, rightHandOperand, options);
}

/**
 * Many comparisons can be canceled out early via simple equality or primitive checks.
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @return {Boolean|null} equal match
 */
function simpleEqual(leftHandOperand, rightHandOperand) {
  // Equal references (except for Numbers) can be returned early
  if (leftHandOperand === rightHandOperand) {
    // Handle +-0 cases
    return leftHandOperand !== 0 || 1 / leftHandOperand === 1 / rightHandOperand;
  }

  // handle NaN cases
  if (
    leftHandOperand !== leftHandOperand && // eslint-disable-line no-self-compare
    rightHandOperand !== rightHandOperand // eslint-disable-line no-self-compare
  ) {
    return true;
  }

  // Anything that is not an 'object', i.e. symbols, functions, booleans, numbers,
  // strings, and undefined, can be compared by reference.
  if (isPrimitive(leftHandOperand) || isPrimitive(rightHandOperand)) {
    // Easy out b/c it would have passed the first equality check
    return false;
  }
  return null;
}

/*!
 * The main logic of the `deepEqual` function.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (optional) Additional options
 * @param {Array} [options.comparator] (optional) Override default algorithm, determining custom equality.
 * @param {Array} [options.memoize] (optional) Provide a custom memoization object which will cache the results of
    complex objects for a speed boost. By passing `false` you can disable memoization, but this will cause circular
    references to blow the stack.
 * @return {Boolean} equal match
*/
function extensiveDeepEqual(leftHandOperand, rightHandOperand, options) {
  options = options || {};
  options.memoize = options.memoize === false ? false : options.memoize || new MemoizeMap();
  var comparator = options && options.comparator;

  // Check if a memoized result exists.
  var memoizeResultLeft = memoizeCompare(leftHandOperand, rightHandOperand, options.memoize);
  if (memoizeResultLeft !== null) {
    return memoizeResultLeft;
  }
  var memoizeResultRight = memoizeCompare(rightHandOperand, leftHandOperand, options.memoize);
  if (memoizeResultRight !== null) {
    return memoizeResultRight;
  }

  // If a comparator is present, use it.
  if (comparator) {
    var comparatorResult = comparator(leftHandOperand, rightHandOperand);
    // Comparators may return null, in which case we want to go back to default behavior.
    if (comparatorResult === false || comparatorResult === true) {
      memoizeSet(leftHandOperand, rightHandOperand, options.memoize, comparatorResult);
      return comparatorResult;
    }
    // To allow comparators to override *any* behavior, we ran them first. Since it didn't decide
    // what to do, we need to make sure to return the basic tests first before we move on.
    var simpleResult = simpleEqual(leftHandOperand, rightHandOperand);
    if (simpleResult !== null) {
      // Don't memoize this, it takes longer to set/retrieve than to just compare.
      return simpleResult;
    }
  }

  var leftHandType = type(leftHandOperand);
  if (leftHandType !== type(rightHandOperand)) {
    memoizeSet(leftHandOperand, rightHandOperand, options.memoize, false);
    return false;
  }

  // Temporarily set the operands in the memoize object to prevent blowing the stack
  memoizeSet(leftHandOperand, rightHandOperand, options.memoize, true);

  var result = extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options);
  memoizeSet(leftHandOperand, rightHandOperand, options.memoize, result);
  return result;
}

function extensiveDeepEqualByType(leftHandOperand, rightHandOperand, leftHandType, options) {
  switch (leftHandType) {
    case 'String':
    case 'Number':
    case 'Boolean':
    case 'Date':
      // If these types are their instance types (e.g. `new Number`) then re-deepEqual against their values
      return deepEqual(leftHandOperand.valueOf(), rightHandOperand.valueOf());
    case 'Promise':
    case 'Symbol':
    case 'function':
    case 'WeakMap':
    case 'WeakSet':
    case 'Error':
      return leftHandOperand === rightHandOperand;
    case 'Arguments':
    case 'Int8Array':
    case 'Uint8Array':
    case 'Uint8ClampedArray':
    case 'Int16Array':
    case 'Uint16Array':
    case 'Int32Array':
    case 'Uint32Array':
    case 'Float32Array':
    case 'Float64Array':
    case 'Array':
      return iterableEqual(leftHandOperand, rightHandOperand, options);
    case 'RegExp':
      return regexpEqual(leftHandOperand, rightHandOperand);
    case 'Generator':
      return generatorEqual(leftHandOperand, rightHandOperand, options);
    case 'DataView':
      return iterableEqual(new Uint8Array(leftHandOperand.buffer), new Uint8Array(rightHandOperand.buffer), options);
    case 'ArrayBuffer':
      return iterableEqual(new Uint8Array(leftHandOperand), new Uint8Array(rightHandOperand), options);
    case 'Set':
      return entriesEqual(leftHandOperand, rightHandOperand, options);
    case 'Map':
      return entriesEqual(leftHandOperand, rightHandOperand, options);
    default:
      return objectEqual(leftHandOperand, rightHandOperand, options);
  }
}

/*!
 * Compare two Regular Expressions for equality.
 *
 * @param {RegExp} leftHandOperand
 * @param {RegExp} rightHandOperand
 * @return {Boolean} result
 */

function regexpEqual(leftHandOperand, rightHandOperand) {
  return leftHandOperand.toString() === rightHandOperand.toString();
}

/*!
 * Compare two Sets/Maps for equality. Faster than other equality functions.
 *
 * @param {Set} leftHandOperand
 * @param {Set} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function entriesEqual(leftHandOperand, rightHandOperand, options) {
  // IE11 doesn't support Set#entries or Set#@@iterator, so we need manually populate using Set#forEach
  if (leftHandOperand.size !== rightHandOperand.size) {
    return false;
  }
  if (leftHandOperand.size === 0) {
    return true;
  }
  var leftHandItems = [];
  var rightHandItems = [];
  leftHandOperand.forEach(function gatherEntries(key, value) {
    leftHandItems.push([ key, value ]);
  });
  rightHandOperand.forEach(function gatherEntries(key, value) {
    rightHandItems.push([ key, value ]);
  });
  return iterableEqual(leftHandItems.sort(), rightHandItems.sort(), options);
}

/*!
 * Simple equality for flat iterable objects such as Arrays, TypedArrays or Node.js buffers.
 *
 * @param {Iterable} leftHandOperand
 * @param {Iterable} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function iterableEqual(leftHandOperand, rightHandOperand, options) {
  var length = leftHandOperand.length;
  if (length !== rightHandOperand.length) {
    return false;
  }
  if (length === 0) {
    return true;
  }
  var index = -1;
  while (++index < length) {
    if (deepEqual(leftHandOperand[index], rightHandOperand[index], options) === false) {
      return false;
    }
  }
  return true;
}

/*!
 * Simple equality for generator objects such as those returned by generator functions.
 *
 * @param {Iterable} leftHandOperand
 * @param {Iterable} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function generatorEqual(leftHandOperand, rightHandOperand, options) {
  return iterableEqual(getGeneratorEntries(leftHandOperand), getGeneratorEntries(rightHandOperand), options);
}

/*!
 * Determine if the given object has an @@iterator function.
 *
 * @param {Object} target
 * @return {Boolean} `true` if the object has an @@iterator function.
 */
function hasIteratorFunction(target) {
  return typeof Symbol !== 'undefined' &&
    typeof target === 'object' &&
    typeof Symbol.iterator !== 'undefined' &&
    typeof target[Symbol.iterator] === 'function';
}

/*!
 * Gets all iterator entries from the given Object. If the Object has no @@iterator function, returns an empty array.
 * This will consume the iterator - which could have side effects depending on the @@iterator implementation.
 *
 * @param {Object} target
 * @returns {Array} an array of entries from the @@iterator function
 */
function getIteratorEntries(target) {
  if (hasIteratorFunction(target)) {
    try {
      return getGeneratorEntries(target[Symbol.iterator]());
    } catch (iteratorError) {
      return [];
    }
  }
  return [];
}

/*!
 * Gets all entries from a Generator. This will consume the generator - which could have side effects.
 *
 * @param {Generator} target
 * @returns {Array} an array of entries from the Generator.
 */
function getGeneratorEntries(generator) {
  var generatorResult = generator.next();
  var accumulator = [ generatorResult.value ];
  while (generatorResult.done === false) {
    generatorResult = generator.next();
    accumulator.push(generatorResult.value);
  }
  return accumulator;
}

/*!
 * Gets all own and inherited enumerable keys from a target.
 *
 * @param {Object} target
 * @returns {Array} an array of own and inherited enumerable keys from the target.
 */
function getEnumerableKeys(target) {
  var keys = [];
  for (var key in target) {
    keys.push(key);
  }
  return keys;
}

/*!
 * Determines if two objects have matching values, given a set of keys. Defers to deepEqual for the equality check of
 * each key. If any value of the given key is not equal, the function will return false (early).
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Array} keys An array of keys to compare the values of leftHandOperand and rightHandOperand against
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */
function keysEqual(leftHandOperand, rightHandOperand, keys, options) {
  var length = keys.length;
  if (length === 0) {
    return true;
  }
  for (var i = 0; i < length; i += 1) {
    if (deepEqual(leftHandOperand[keys[i]], rightHandOperand[keys[i]], options) === false) {
      return false;
    }
  }
  return true;
}

/*!
 * Recursively check the equality of two Objects. Once basic sameness has been established it will defer to `deepEqual`
 * for each enumerable key in the object.
 *
 * @param {Mixed} leftHandOperand
 * @param {Mixed} rightHandOperand
 * @param {Object} [options] (Optional)
 * @return {Boolean} result
 */

function objectEqual(leftHandOperand, rightHandOperand, options) {
  var leftHandKeys = getEnumerableKeys(leftHandOperand);
  var rightHandKeys = getEnumerableKeys(rightHandOperand);
  if (leftHandKeys.length && leftHandKeys.length === rightHandKeys.length) {
    leftHandKeys.sort();
    rightHandKeys.sort();
    if (iterableEqual(leftHandKeys, rightHandKeys) === false) {
      return false;
    }
    return keysEqual(leftHandOperand, rightHandOperand, leftHandKeys, options);
  }

  var leftHandEntries = getIteratorEntries(leftHandOperand);
  var rightHandEntries = getIteratorEntries(rightHandOperand);
  if (leftHandEntries.length && leftHandEntries.length === rightHandEntries.length) {
    leftHandEntries.sort();
    rightHandEntries.sort();
    return iterableEqual(leftHandEntries, rightHandEntries, options);
  }

  if (leftHandKeys.length === 0 &&
      leftHandEntries.length === 0 &&
      rightHandKeys.length === 0 &&
      rightHandEntries.length === 0) {
    return true;
  }

  return false;
}

/*!
 * Returns true if the argument is a primitive.
 *
 * This intentionally returns true for all objects that can be compared by reference,
 * including functions and symbols.
 *
 * @param {Mixed} value
 * @return {Boolean} result
 */
function isPrimitive(value) {
  return value === null || typeof value !== 'object';
}

},{"type-detect":40}],37:[function(require,module,exports){
'use strict';

/* !
 * Chai - getFuncName utility
 * Copyright(c) 2012-2016 Jake Luer <jake@alogicalparadox.com>
 * MIT Licensed
 */

/**
 * ### .getFuncName(constructorFn)
 *
 * Returns the name of a function.
 * When a non-function instance is passed, returns `null`.
 * This also includes a polyfill function if `aFunc.name` is not defined.
 *
 * @name getFuncName
 * @param {Function} funct
 * @namespace Utils
 * @api public
 */

var toString = Function.prototype.toString;
var functionNameMatch = /\s*function(?:\s|\s*\/\*[^(?:*\/)]+\*\/\s*)*([^\s\(\/]+)/;
function getFuncName(aFunc) {
  if (typeof aFunc !== 'function') {
    return null;
  }

  var name = '';
  if (typeof Function.prototype.name === 'undefined' && typeof aFunc.name === 'undefined') {
    // Here we run a polyfill if Function does not support the `name` property and if aFunc.name is not defined
    var match = toString.call(aFunc).match(functionNameMatch);
    if (match) {
      name = match[1];
    }
  } else {
    // If we've got a `name` property we just use it
    name = aFunc.name;
  }

  return name;
}

module.exports = getFuncName;

},{}],38:[function(require,module,exports){
(function (global){
/*! OpenPGP.js v4.4.7 - 2019-02-06 - this is LGPL licensed code, see LICENSE/our website https://openpgpjs.org/ for more information. */
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).openpgp=e()}}(function(){return function(){return function e(t,r,n){function i(s,o){if(!r[s]){if(!t[s]){var u="function"==typeof require&&require;if(!o&&u)return u(s,!0);if(a)return a(s,!0);var c=new Error("Cannot find module '"+s+"'");throw c.code="MODULE_NOT_FOUND",c}var f=r[s]={exports:{}};t[s][0].call(f.exports,function(e){return i(t[s][1][e]||e)},f,f.exports,e,t,r,n)}return r[s].exports}for(var a="function"==typeof require&&require,s=0;s<n.length;s++)i(n[s]);return i}}()({1:[function(e,t,r){(function(e){var n;n=this,function(t){"use strict";function r(e,t){for(var r=0;r<t.length;r++){var n=t[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(e,n.key,n)}}function n(e,t,n){return t&&r(e.prototype,t),n&&r(e,n),e}function i(){return(i=Object.assign||function(e){for(var t=1;t<arguments.length;t++){var r=arguments[t];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(e[n]=r[n])}return e}).apply(this,arguments)}var a=Number.isInteger||function(e){return"number"==typeof e&&isFinite(e)&&Math.floor(e)===e},s="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?Symbol:function(e){return"Symbol("+e+")"};function o(){}var u="undefined"!=typeof self?self:"undefined"!=typeof window?window:void 0!==e?e:void 0,c=Number.isNaN||function(e){return e!=e},f=function(e,t){return function(e,t){var r=s('is "detached" for our purposes');function n(e,t,r){if("function"!=typeof e)throw new TypeError("Argument is not a function");return Function.prototype.apply.call(e,t,r)}function i(e,t,r){try{return Promise.resolve(n(e,t,r))}catch(e){return Promise.reject(e)}}t.typeIsObject=function(e){return"object"==typeof e&&null!==e||"function"==typeof e},t.createDataProperty=function(e,t,r){Object.defineProperty(e,t,{value:r,writable:!0,enumerable:!0,configurable:!0})},t.createArrayFromList=function(e){return e.slice()},t.ArrayBufferCopy=function(e,t,r,n,i){new Uint8Array(e).set(new Uint8Array(r,n,i),t)},t.CreateIterResultObject=function(e,t){var r={};return Object.defineProperty(r,"value",{value:e,enumerable:!0,writable:!0,configurable:!0}),Object.defineProperty(r,"done",{value:t,enumerable:!0,writable:!0,configurable:!0}),r},t.IsFiniteNonNegativeNumber=function(e){return!1!==t.IsNonNegativeNumber(e)&&e!==1/0},t.IsNonNegativeNumber=function(e){return!("number"!=typeof e||c(e)||e<0)},t.Call=n,t.CreateAlgorithmFromUnderlyingMethod=function(e,t,r,n){var a=e[t];if(void 0!==a){if("function"!=typeof a)throw new TypeError(a+" is not a method");switch(r){case 0:return function(){return i(a,e,n)};case 1:return function(t){var r=[t].concat(n);return i(a,e,r)}}}return function(){return Promise.resolve()}},t.InvokeOrNoop=function(e,t,r){var i=e[t];if(void 0!==i)return n(i,e,r)},t.PromiseCall=i,t.TransferArrayBuffer=function(e){var t=e.slice();return Object.defineProperty(e,"byteLength",{get:function(){return 0}}),e[r]=!0,t},t.IsDetachedBuffer=function(e){return r in e},t.ValidateAndNormalizeHighWaterMark=function(e){if(e=Number(e),c(e)||e<0)throw new RangeError("highWaterMark property of a queuing strategy must be non-negative and non-NaN");return e},t.MakeSizeAlgorithmFromSizeFunction=function(e){if(void 0===e)return function(){return 1};if("function"!=typeof e)throw new TypeError("size property of a queuing strategy must be a function");return function(t){return e(t)}}}(t={exports:{}},t.exports),t.exports}(),d={default:f,__moduleExports:f,typeIsObject:f.typeIsObject,createDataProperty:f.createDataProperty,createArrayFromList:f.createArrayFromList,ArrayBufferCopy:f.ArrayBufferCopy,CreateIterResultObject:f.CreateIterResultObject,IsFiniteNonNegativeNumber:f.IsFiniteNonNegativeNumber,IsNonNegativeNumber:f.IsNonNegativeNumber,Call:f.Call,CreateAlgorithmFromUnderlyingMethod:f.CreateAlgorithmFromUnderlyingMethod,InvokeOrNoop:f.InvokeOrNoop,PromiseCall:f.PromiseCall,TransferArrayBuffer:f.TransferArrayBuffer,IsDetachedBuffer:f.IsDetachedBuffer,ValidateAndNormalizeHighWaterMark:f.ValidateAndNormalizeHighWaterMark,MakeSizeAlgorithmFromSizeFunction:f.MakeSizeAlgorithmFromSizeFunction};function l(){}l.AssertionError=o;var h={default:l},p=h&&l||h,y=function(e){e&&e instanceof p.AssertionError&&setTimeout(function(){throw e},0)},b={rethrowAssertionErrorRejection:y},m={default:b,__moduleExports:b,rethrowAssertionErrorRejection:y},g=d&&f||d,w=g.IsFiniteNonNegativeNumber,_=function(e){var t=e._queue.shift();return e._queueTotalSize-=t.size,e._queueTotalSize<0&&(e._queueTotalSize=0),t.value},v=function(e,t,r){if(r=Number(r),!w(r))throw new RangeError("Size must be a finite, non-NaN, non-negative number.");e._queue.push({value:t,size:r}),e._queueTotalSize+=r},k=function(e){return e._queue[0].value},A=function(e){e._queue=[],e._queueTotalSize=0},S={DequeueValue:_,EnqueueValueWithSize:v,PeekQueueValue:k,ResetQueue:A},E={default:S,__moduleExports:S,DequeueValue:_,EnqueueValueWithSize:v,PeekQueueValue:k,ResetQueue:A},P={default:o},x=P&&o||P,M=m&&b||m,C=E&&S||E,j=(x("streams:writable-stream:verbose"),g.CreateAlgorithmFromUnderlyingMethod),R=g.InvokeOrNoop,B=g.ValidateAndNormalizeHighWaterMark,K=(g.IsNonNegativeNumber,g.MakeSizeAlgorithmFromSizeFunction),I=g.typeIsObject,U=M.rethrowAssertionErrorRejection,T=C.DequeueValue,z=C.EnqueueValueWithSize,O=C.PeekQueueValue,D=C.ResetQueue,N=s("[[AbortSteps]]"),q=s("[[ErrorSteps]]"),F=function(){function e(e,t){void 0===e&&(e={});var r=void 0===t?{}:t,n=r.size,i=r.highWaterMark,a=void 0===i?1:i;if(H(this),void 0!==e.type)throw new RangeError("Invalid type is specified");var s=K(n);!function(e,t,r,n){var i=Object.create(oe.prototype),a=j(t,"write",1,[i]),s=j(t,"close",0,[]),o=j(t,"abort",1,[]);ue(e,i,function(){return R(t,"start",[i])},a,s,o,r,n)}(this,e,a=B(a),s)}var t=e.prototype;return t.abort=function(e){return!1===Z(this)?Promise.reject(pe("abort")):!0===G(this)?Promise.reject(new TypeError("Cannot abort a stream that already has a writer")):V(this,e)},t.getWriter=function(){if(!1===Z(this))throw pe("getWriter");return W(this)},n(e,[{key:"locked",get:function(){if(!1===Z(this))throw pe("locked");return G(this)}}]),e}(),L={AcquireWritableStreamDefaultWriter:W,CreateWritableStream:function(e,t,r,n,i,a){void 0===i&&(i=1),void 0===a&&(a=function(){return 1});var s=Object.create(F.prototype);return H(s),ue(s,Object.create(oe.prototype),e,t,r,n,i,a),s},IsWritableStream:Z,IsWritableStreamLocked:G,WritableStream:F,WritableStreamAbort:V,WritableStreamDefaultControllerErrorIfNeeded:de,WritableStreamDefaultWriterCloseWithErrorPropagation:function(e){var t=e._ownerWritableStream,r=t._state;return!0===J(t)||"closed"===r?Promise.resolve():"errored"===r?Promise.reject(t._storedError):ne(e)},WritableStreamDefaultWriterRelease:ae,WritableStreamDefaultWriterWrite:se,WritableStreamCloseQueuedOrInFlight:J};function W(e){return new te(e)}function H(e){e._state="writable",e._storedError=void 0,e._writer=void 0,e._writableStreamController=void 0,e._writeRequests=[],e._inFlightWriteRequest=void 0,e._closeRequest=void 0,e._inFlightCloseRequest=void 0,e._pendingAbortRequest=void 0,e._backpressure=!1}function Z(e){return!!I(e)&&!!Object.prototype.hasOwnProperty.call(e,"_writableStreamController")}function G(e){return void 0!==e._writer}function V(e,t){var r=e._state;if("closed"===r||"errored"===r)return Promise.resolve(void 0);if(void 0!==e._pendingAbortRequest)return e._pendingAbortRequest._promise;var n=!1;"erroring"===r&&(n=!0,t=void 0);var i=new Promise(function(r,i){e._pendingAbortRequest={_resolve:r,_reject:i,_reason:t,_wasAlreadyErroring:n}});return e._pendingAbortRequest._promise=i,!1===n&&X(e,t),i}function Y(e,t){"writable"!==e._state?$(e):X(e,t)}function X(e,t){var r=e._writableStreamController;e._state="erroring",e._storedError=t;var n=e._writer;void 0!==n&&ie(n,t),!1===function(e){return void 0!==e._inFlightWriteRequest||void 0!==e._inFlightCloseRequest}(e)&&!0===r._started&&$(e)}function $(e){e._state="errored",e._writableStreamController[q]();for(var t=e._storedError,r=0,n=e._writeRequests;r<n.length;r++)n[r]._reject(t);if(e._writeRequests=[],void 0!==e._pendingAbortRequest){var i=e._pendingAbortRequest;if(e._pendingAbortRequest=void 0,!0===i._wasAlreadyErroring)return i._reject(t),void Q(e);e._writableStreamController[N](i._reason).then(function(){i._resolve(),Q(e)},function(t){i._reject(t),Q(e)})}else Q(e)}function J(e){return void 0!==e._closeRequest||void 0!==e._inFlightCloseRequest}function Q(e){void 0!==e._closeRequest&&(e._closeRequest._reject(e._storedError),e._closeRequest=void 0);var t=e._writer;void 0!==t&&(ge(t,e._storedError),t._closedPromise.catch(function(){}))}function ee(e,t){var r=e._writer;void 0!==r&&t!==e._backpressure&&(!0===t?function(e){e._readyPromise=new Promise(function(t,r){e._readyPromise_resolve=t,e._readyPromise_reject=r}),e._readyPromiseState="pending"}(r):ve(r)),e._backpressure=t}var te=function(){function e(e){if(!1===Z(e))throw new TypeError("WritableStreamDefaultWriter can only be constructed with a WritableStream instance");if(!0===G(e))throw new TypeError("This stream has already been locked for exclusive writing by another writer");this._ownerWritableStream=e,e._writer=this;var t=e._state;if("writable"===t)!1===J(e)&&!0===e._backpressure?function(e){e._readyPromise=new Promise(function(t,r){e._readyPromise_resolve=t,e._readyPromise_reject=r}),e._readyPromiseState="pending"}(this):_e(this),me(this);else if("erroring"===t)we(this,e._storedError),this._readyPromise.catch(function(){}),me(this);else if("closed"===t)_e(this),function(e){e._closedPromise=Promise.resolve(void 0),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0,e._closedPromiseState="resolved"}(this);else{var r=e._storedError;we(this,r),this._readyPromise.catch(function(){}),function(e,t){e._closedPromise=Promise.reject(t),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0,e._closedPromiseState="rejected"}(this,r),this._closedPromise.catch(function(){})}}var t=e.prototype;return t.abort=function(e){return!1===re(this)?Promise.reject(ye("abort")):void 0===this._ownerWritableStream?Promise.reject(be("abort")):function(e,t){return V(e._ownerWritableStream,t)}(this,e)},t.close=function(){if(!1===re(this))return Promise.reject(ye("close"));var e=this._ownerWritableStream;return void 0===e?Promise.reject(be("close")):!0===J(e)?Promise.reject(new TypeError("cannot close an already-closing stream")):ne(this)},t.releaseLock=function(){if(!1===re(this))throw ye("releaseLock");void 0!==this._ownerWritableStream&&ae(this)},t.write=function(e){return!1===re(this)?Promise.reject(ye("write")):void 0===this._ownerWritableStream?Promise.reject(be("write to")):se(this,e)},n(e,[{key:"closed",get:function(){return!1===re(this)?Promise.reject(ye("closed")):this._closedPromise}},{key:"desiredSize",get:function(){if(!1===re(this))throw ye("desiredSize");if(void 0===this._ownerWritableStream)throw be("desiredSize");return e=this._ownerWritableStream,"errored"===(t=e._state)||"erroring"===t?null:"closed"===t?0:ce(e._writableStreamController);var e,t}},{key:"ready",get:function(){return!1===re(this)?Promise.reject(ye("ready")):this._readyPromise}}]),e}();function re(e){return!!I(e)&&!!Object.prototype.hasOwnProperty.call(e,"_ownerWritableStream")}function ne(e){var t=e._ownerWritableStream,r=t._state;if("closed"===r||"errored"===r)return Promise.reject(new TypeError("The stream (in "+r+" state) is not in the writable state and cannot be closed"));var n=new Promise(function(e,r){var n={_resolve:e,_reject:r};t._closeRequest=n});return!0===t._backpressure&&"writable"===r&&ve(e),function(e){z(e,"close",0),fe(e)}(t._writableStreamController),n}function ie(e,t){"pending"===e._readyPromiseState?function(e,t){e._readyPromise_reject(t),e._readyPromise_resolve=void 0,e._readyPromise_reject=void 0,e._readyPromiseState="rejected"}(e,t):function(e,t){e._readyPromise=Promise.reject(t),e._readyPromiseState="rejected"}(e,t),e._readyPromise.catch(function(){})}function ae(e){var t=e._ownerWritableStream,r=new TypeError("Writer was released and can no longer be used to monitor the stream's closedness");ie(e,r),function(e,t){"pending"===e._closedPromiseState?ge(e,t):function(e,t){e._closedPromise=Promise.reject(t),e._closedPromiseState="rejected"}(e,t),e._closedPromise.catch(function(){})}(e,r),t._writer=void 0,e._ownerWritableStream=void 0}function se(e,t){var r=e._ownerWritableStream,n=r._writableStreamController,i=function(e,t){try{return e._strategySizeAlgorithm(t)}catch(t){return de(e,t),1}}(n,t);if(r!==e._ownerWritableStream)return Promise.reject(be("write to"));var a=r._state;if("errored"===a)return Promise.reject(r._storedError);if(!0===J(r)||"closed"===a)return Promise.reject(new TypeError("The stream is closing or closed and cannot be written to"));if("erroring"===a)return Promise.reject(r._storedError);var s=function(e){return new Promise(function(t,r){var n={_resolve:t,_reject:r};e._writeRequests.push(n)})}(r);return function(e,t,r){var n={chunk:t};try{z(e,n,r)}catch(t){return void de(e,t)}var i=e._controlledWritableStream;!1===J(i)&&"writable"===i._state&&ee(i,le(e));fe(e)}(n,t,i),s}var oe=function(){function e(){throw new TypeError("WritableStreamDefaultController cannot be constructed explicitly")}var t=e.prototype;return t.error=function(e){if(!1===function(e){return!!I(e)&&!!Object.prototype.hasOwnProperty.call(e,"_controlledWritableStream")}(this))throw new TypeError("WritableStreamDefaultController.prototype.error can only be used on a WritableStreamDefaultController");"writable"===this._controlledWritableStream._state&&he(this,e)},t[N]=function(e){return this._abortAlgorithm(e)},t[q]=function(){D(this)},e}();function ue(e,t,r,n,i,a,s,o){t._controlledWritableStream=e,e._writableStreamController=t,t._queue=void 0,t._queueTotalSize=void 0,D(t),t._started=!1,t._strategySizeAlgorithm=o,t._strategyHWM=s,t._writeAlgorithm=n,t._closeAlgorithm=i,t._abortAlgorithm=a;var u=le(t);ee(e,u);var c=r();Promise.resolve(c).then(function(){t._started=!0,fe(t)},function(r){t._started=!0,Y(e,r)}).catch(U)}function ce(e){return e._strategyHWM-e._queueTotalSize}function fe(e){var t=e._controlledWritableStream;if(!1!==e._started&&void 0===t._inFlightWriteRequest){var r=t._state;if("closed"!==r&&"errored"!==r)if("erroring"!==r){if(0!==e._queue.length){var n=O(e);"close"===n?function(e){var t=e._controlledWritableStream;(function(e){e._inFlightCloseRequest=e._closeRequest,e._closeRequest=void 0})(t),T(e),e._closeAlgorithm().then(function(){!function(e){e._inFlightCloseRequest._resolve(void 0),e._inFlightCloseRequest=void 0,"erroring"===e._state&&(e._storedError=void 0,void 0!==e._pendingAbortRequest&&(e._pendingAbortRequest._resolve(),e._pendingAbortRequest=void 0)),e._state="closed";var t=e._writer;void 0!==t&&function(e){e._closedPromise_resolve(void 0),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0,e._closedPromiseState="resolved"}(t)}(t)},function(e){!function(e,t){e._inFlightCloseRequest._reject(t),e._inFlightCloseRequest=void 0,void 0!==e._pendingAbortRequest&&(e._pendingAbortRequest._reject(t),e._pendingAbortRequest=void 0),Y(e,t)}(t,e)}).catch(U)}(e):function(e,t){var r=e._controlledWritableStream;(function(e){e._inFlightWriteRequest=e._writeRequests.shift()})(r),e._writeAlgorithm(t).then(function(){!function(e){e._inFlightWriteRequest._resolve(void 0),e._inFlightWriteRequest=void 0}(r);var t=r._state;if(T(e),!1===J(r)&&"writable"===t){var n=le(e);ee(r,n)}fe(e)},function(e){!function(e,t){e._inFlightWriteRequest._reject(t),e._inFlightWriteRequest=void 0,Y(e,t)}(r,e)}).catch(U)}(e,n.chunk)}}else $(t)}}function de(e,t){"writable"===e._controlledWritableStream._state&&he(e,t)}function le(e){return ce(e)<=0}function he(e,t){X(e._controlledWritableStream,t)}function pe(e){return new TypeError("WritableStream.prototype."+e+" can only be used on a WritableStream")}function ye(e){return new TypeError("WritableStreamDefaultWriter.prototype."+e+" can only be used on a WritableStreamDefaultWriter")}function be(e){return new TypeError("Cannot "+e+" a stream using a released writer")}function me(e){e._closedPromise=new Promise(function(t,r){e._closedPromise_resolve=t,e._closedPromise_reject=r,e._closedPromiseState="pending"})}function ge(e,t){e._closedPromise_reject(t),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0,e._closedPromiseState="rejected"}function we(e,t){e._readyPromise=Promise.reject(t),e._readyPromise_resolve=void 0,e._readyPromise_reject=void 0,e._readyPromiseState="rejected"}function _e(e){e._readyPromise=Promise.resolve(void 0),e._readyPromise_resolve=void 0,e._readyPromise_reject=void 0,e._readyPromiseState="fulfilled"}function ve(e){e._readyPromise_resolve(void 0),e._readyPromise_resolve=void 0,e._readyPromise_reject=void 0,e._readyPromiseState="fulfilled"}var ke=L.WritableStream,Ae=g.ArrayBufferCopy,Se=g.CreateAlgorithmFromUnderlyingMethod,Ee=g.CreateIterResultObject,Pe=g.IsFiniteNonNegativeNumber,xe=g.InvokeOrNoop,Me=g.IsDetachedBuffer,Ce=g.TransferArrayBuffer,je=g.ValidateAndNormalizeHighWaterMark,Re=(g.IsNonNegativeNumber,g.MakeSizeAlgorithmFromSizeFunction),Be=g.createArrayFromList,Ke=g.typeIsObject,Ie=M.rethrowAssertionErrorRejection,Ue=C.DequeueValue,Te=C.EnqueueValueWithSize,ze=C.ResetQueue,Oe=L.AcquireWritableStreamDefaultWriter,De=L.IsWritableStream,Ne=L.IsWritableStreamLocked,qe=L.WritableStreamAbort,Fe=L.WritableStreamDefaultWriterCloseWithErrorPropagation,Le=L.WritableStreamDefaultWriterRelease,We=L.WritableStreamDefaultWriterWrite,He=L.WritableStreamCloseQueuedOrInFlight,Ze=s("[[CancelSteps]]"),Ge=s("[[PullSteps]]"),Ve=function(){function e(e,t){void 0===e&&(e={});var r=void 0===t?{}:t,n=r.size,i=r.highWaterMark;Je(this);var s=e.type;if("bytes"===String(s)){if(void 0===i&&(i=0),i=je(i),void 0!==n)throw new RangeError("The strategy for a byte stream cannot have a size function");!function(e,t,r){var n=Object.create(jt.prototype),i=Se(t,"pull",0,[n]),s=Se(t,"cancel",1,[]),o=t.autoAllocateChunkSize;if(void 0!==o&&(!1===a(o)||o<=0))throw new RangeError("autoAllocateChunkSize must be a positive integer");Gt(e,n,function(){return xe(t,"start",[n])},i,s,r,o)}(this,e,i)}else{if(void 0!==s)throw new RangeError("Invalid type is specified");void 0===i&&(i=1),function(e,t,r,n){var i=Object.create(wt.prototype),a=Se(t,"pull",0,[i]),s=Se(t,"cancel",1,[]);Mt(e,i,function(){return xe(t,"start",[i])},a,s,r,n)}(this,e,i=je(i),Re(n))}}var t=e.prototype;return t.cancel=function(e){return!1===Qe(this)?Promise.reject(Vt("cancel")):!0===et(this)?Promise.reject(new TypeError("Cannot cancel a stream that already has a reader")):nt(this,e)},t.getReader=function(e){var t=(void 0===e?{}:e).mode;if(!1===Qe(this))throw Vt("getReader");if(void 0===t)return Xe(this);if("byob"===(t=String(t)))return function(e){return new lt(e)}(this);throw new RangeError("Invalid mode is specified")},t.pipeThrough=function(e,t){var r=e.writable,n=e.readable;if(void 0===r||void 0===n)throw new TypeError("readable and writable arguments must be defined");return function(e){try{Promise.prototype.then.call(e,void 0,function(){})}catch(e){}}(this.pipeTo(r,t)),n},t.pipeTo=function(e,t){var r=this,n=void 0===t?{}:t,i=n.preventClose,a=n.preventAbort,s=n.preventCancel;if(!1===Qe(this))return Promise.reject(Vt("pipeTo"));if(!1===De(e))return Promise.reject(new TypeError("ReadableStream.prototype.pipeTo's first argument must be a WritableStream"));if(i=Boolean(i),a=Boolean(a),s=Boolean(s),!0===et(this))return Promise.reject(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked ReadableStream"));if(!0===Ne(e))return Promise.reject(new TypeError("ReadableStream.prototype.pipeTo cannot be used on a locked WritableStream"));var o=Xe(this),u=Oe(e),c=!1,f=Promise.resolve();return new Promise(function(t,n){if(h(r,o._closedPromise,function(t){!1===a?p(function(){return qe(e,t)},!0,t):y(!0,t)}),h(e,u._closedPromise,function(e){!1===s?p(function(){return nt(r,e)},!0,e):y(!0,e)}),function(e,t,r){"closed"===e._state?r():t.then(r).catch(Ie)}(r,o._closedPromise,function(){!1===i?p(function(){return Fe(u)}):y()}),!0===He(e)||"closed"===e._state){var d=new TypeError("the destination writable stream closed before all data could be piped to it");!1===s?p(function(){return nt(r,d)},!0,d):y(!0,d)}function l(){var e=f;return f.then(function(){return e!==f?l():void 0})}function h(e,t,r){"errored"===e._state?r(e._storedError):t.catch(r).catch(Ie)}function p(t,r,n){function i(){t().then(function(){return b(r,n)},function(e){return b(!0,e)}).catch(Ie)}!0!==c&&(c=!0,"writable"===e._state&&!1===He(e)?l().then(i):i())}function y(t,r){!0!==c&&(c=!0,"writable"===e._state&&!1===He(e)?l().then(function(){return b(t,r)}).catch(Ie):b(t,r))}function b(e,r){Le(u),mt(o),e?n(r):t(void 0)}(function e(){return!0===c?Promise.resolve():u._readyPromise.then(function(){return gt(o).then(function(e){var t=e.value;!0!==e.done&&(f=We(u,t).catch(function(){}))})}).then(e)})().catch(function(e){f=Promise.resolve(),Ie(e)})})},t.tee=function(){if(!1===Qe(this))throw Vt("tee");var e=function(e,t){var r,n,i,a,s,o=Xe(e),u=!1,c=!1,f=!1,d=new Promise(function(e){s=e});function l(){return gt(o).then(function(e){var t=e.value;if(!0===e.done&&!1===u&&(!1===c&&At(i._readableStreamController),!1===f&&At(a._readableStreamController),u=!0),!0!==u){var r=t,n=t;!1===c&&St(i._readableStreamController,r),!1===f&&St(a._readableStreamController,n)}})}function h(){}return i=$e(h,l,function(t){if(c=!0,r=t,!0===f){var i=Be([r,n]),a=nt(e,i);s(a)}return d}),a=$e(h,l,function(t){if(f=!0,n=t,!0===c){var i=Be([r,n]),a=nt(e,i);s(a)}return d}),o._closedPromise.catch(function(e){!0!==u&&(Et(i._readableStreamController,e),Et(a._readableStreamController,e),u=!0)}),[i,a]}(this);return Be(e)},n(e,[{key:"locked",get:function(){if(!1===Qe(this))throw Vt("locked");return et(this)}}]),e}(),Ye={CreateReadableByteStream:function(e,t,r,n,i){void 0===n&&(n=0),void 0===i&&(i=void 0);var a=Object.create(Ve.prototype);return Je(a),Gt(a,Object.create(jt.prototype),e,t,r,n,i),a},CreateReadableStream:$e,ReadableStream:Ve,IsReadableStreamDisturbed:function(e){return e._disturbed},ReadableStreamDefaultControllerClose:At,ReadableStreamDefaultControllerEnqueue:St,ReadableStreamDefaultControllerError:Et,ReadableStreamDefaultControllerGetDesiredSize:Pt,ReadableStreamDefaultControllerHasBackpressure:function(e){return!0!==kt(e)},ReadableStreamDefaultControllerCanCloseOrEnqueue:xt};function Xe(e){return new dt(e)}function $e(e,t,r,n,i){void 0===n&&(n=1),void 0===i&&(i=function(){return 1});var a=Object.create(Ve.prototype);return Je(a),Mt(a,Object.create(wt.prototype),e,t,r,n,i),a}function Je(e){e._state="readable",e._reader=void 0,e._storedError=void 0,e._disturbed=!1}function Qe(e){return!!Ke(e)&&!!Object.prototype.hasOwnProperty.call(e,"_readableStreamController")}function et(e){return void 0!==e._reader}function tt(e){return new Promise(function(t,r){var n={_resolve:t,_reject:r};e._reader._readIntoRequests.push(n)})}function rt(e){return new Promise(function(t,r){var n={_resolve:t,_reject:r};e._reader._readRequests.push(n)})}function nt(e,t){return e._disturbed=!0,"closed"===e._state?Promise.resolve(void 0):"errored"===e._state?Promise.reject(e._storedError):(it(e),e._readableStreamController[Ze](t).then(function(){}))}function it(e){e._state="closed";var t=e._reader;if(void 0!==t){if(!0===pt(t)){for(var r=0,n=t._readRequests;r<n.length;r++)(0,n[r]._resolve)(Ee(void 0,!0));t._readRequests=[]}!function(e){e._closedPromise_resolve(void 0),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0}(t)}}function at(e,t){e._state="errored",e._storedError=t;var r=e._reader;if(void 0!==r){if(!0===pt(r)){for(var n=0,i=r._readRequests;n<i.length;n++)i[n]._reject(t);r._readRequests=[]}else{for(var a=0,s=r._readIntoRequests;a<s.length;a++)s[a]._reject(t);r._readIntoRequests=[]}$t(r,t),r._closedPromise.catch(function(){})}}function st(e,t,r){e._reader._readRequests.shift()._resolve(Ee(t,r))}function ot(e){return e._reader._readIntoRequests.length}function ut(e){return e._reader._readRequests.length}function ct(e){var t=e._reader;return void 0!==t&&!1!==ht(t)}function ft(e){var t=e._reader;return void 0!==t&&!1!==pt(t)}var dt=function(){function e(e){if(!1===Qe(e))throw new TypeError("ReadableStreamDefaultReader can only be constructed with a ReadableStream instance");if(!0===et(e))throw new TypeError("This stream has already been locked for exclusive reading by another reader");yt(this,e),this._readRequests=[]}var t=e.prototype;return t.cancel=function(e){return!1===pt(this)?Promise.reject(Xt("cancel")):void 0===this._ownerReadableStream?Promise.reject(Yt("cancel")):bt(this,e)},t.read=function(){return!1===pt(this)?Promise.reject(Xt("read")):void 0===this._ownerReadableStream?Promise.reject(Yt("read from")):gt(this)},t.releaseLock=function(){if(!1===pt(this))throw Xt("releaseLock");if(void 0!==this._ownerReadableStream){if(this._readRequests.length>0)throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");mt(this)}},n(e,[{key:"closed",get:function(){return!1===pt(this)?Promise.reject(Xt("closed")):this._closedPromise}}]),e}(),lt=function(){function e(e){if(!Qe(e))throw new TypeError("ReadableStreamBYOBReader can only be constructed with a ReadableStream instance given a byte source");if(!1===Rt(e._readableStreamController))throw new TypeError("Cannot construct a ReadableStreamBYOBReader for a stream not constructed with a byte source");if(et(e))throw new TypeError("This stream has already been locked for exclusive reading by another reader");yt(this,e),this._readIntoRequests=[]}var t=e.prototype;return t.cancel=function(e){return ht(this)?void 0===this._ownerReadableStream?Promise.reject(Yt("cancel")):bt(this,e):Promise.reject(Jt("cancel"))},t.read=function(e){return ht(this)?void 0===this._ownerReadableStream?Promise.reject(Yt("read from")):ArrayBuffer.isView(e)?!0===Me(e.buffer)?Promise.reject(new TypeError("Cannot read into a view onto a detached ArrayBuffer")):0===e.byteLength?Promise.reject(new TypeError("view must have non-zero byteLength")):function(e,t){var r=e._ownerReadableStream;return r._disturbed=!0,"errored"===r._state?Promise.reject(r._storedError):function(e,t){var r=e._controlledReadableByteStream,n=1;t.constructor!==DataView&&(n=t.constructor.BYTES_PER_ELEMENT);var i=t.constructor,a={buffer:Ce(t.buffer),byteOffset:t.byteOffset,byteLength:t.byteLength,bytesFilled:0,elementSize:n,ctor:i,readerType:"byob"};if(e._pendingPullIntos.length>0)return e._pendingPullIntos.push(a),tt(r);if("closed"===r._state){var s=new t.constructor(a.buffer,a.byteOffset,0);return Promise.resolve(Ee(s,!0))}if(e._queueTotalSize>0){if(!0===Ot(e,a)){var o=Tt(a);return Nt(e),Promise.resolve(Ee(o,!1))}if(!0===e._closeRequested){var u=new TypeError("Insufficient bytes to fill elements in the given buffer");return Ht(e,u),Promise.reject(u)}}e._pendingPullIntos.push(a);var c=tt(r);return Kt(e),c}(r._readableStreamController,t)}(this,e):Promise.reject(new TypeError("view must be an array buffer view")):Promise.reject(Jt("read"))},t.releaseLock=function(){if(!ht(this))throw Jt("releaseLock");if(void 0!==this._ownerReadableStream){if(this._readIntoRequests.length>0)throw new TypeError("Tried to release a reader lock when that reader has pending read() calls un-settled");mt(this)}},n(e,[{key:"closed",get:function(){return ht(this)?this._closedPromise:Promise.reject(Jt("closed"))}}]),e}();function ht(e){return!!Ke(e)&&!!Object.prototype.hasOwnProperty.call(e,"_readIntoRequests")}function pt(e){return!!Ke(e)&&!!Object.prototype.hasOwnProperty.call(e,"_readRequests")}function yt(e,t){e._ownerReadableStream=t,t._reader=e,"readable"===t._state?function(e){e._closedPromise=new Promise(function(t,r){e._closedPromise_resolve=t,e._closedPromise_reject=r})}(e):"closed"===t._state?function(e){e._closedPromise=Promise.resolve(void 0),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0}(e):(function(e,t){e._closedPromise=Promise.reject(t),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0}(e,t._storedError),e._closedPromise.catch(function(){}))}function bt(e,t){return nt(e._ownerReadableStream,t)}function mt(e){"readable"===e._ownerReadableStream._state?$t(e,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")):function(e,t){e._closedPromise=Promise.reject(t)}(e,new TypeError("Reader was released and can no longer be used to monitor the stream's closedness")),e._closedPromise.catch(function(){}),e._ownerReadableStream._reader=void 0,e._ownerReadableStream=void 0}function gt(e){var t=e._ownerReadableStream;return t._disturbed=!0,"closed"===t._state?Promise.resolve(Ee(void 0,!0)):"errored"===t._state?Promise.reject(t._storedError):t._readableStreamController[Ge]()}var wt=function(){function e(){throw new TypeError}var t=e.prototype;return t.close=function(){if(!1===_t(this))throw Qt("close");if(!1===xt(this))throw new TypeError("The stream is not in a state that permits close");At(this)},t.enqueue=function(e){if(!1===_t(this))throw Qt("enqueue");if(!1===xt(this))throw new TypeError("The stream is not in a state that permits enqueue");return St(this,e)},t.error=function(e){if(!1===_t(this))throw Qt("error");Et(this,e)},t[Ze]=function(e){return ze(this),this._cancelAlgorithm(e)},t[Ge]=function(){var e=this._controlledReadableStream;if(this._queue.length>0){var t=Ue(this);return!0===this._closeRequested&&0===this._queue.length?it(e):vt(this),Promise.resolve(Ee(t,!1))}var r=rt(e);return vt(this),r},n(e,[{key:"desiredSize",get:function(){if(!1===_t(this))throw Qt("desiredSize");return Pt(this)}}]),e}();function _t(e){return!!Ke(e)&&!!Object.prototype.hasOwnProperty.call(e,"_controlledReadableStream")}function vt(e){!1!==kt(e)&&(!0!==e._pulling?(e._pulling=!0,e._pullAlgorithm().then(function(){if(e._pulling=!1,!0===e._pullAgain)return e._pullAgain=!1,vt(e)},function(t){Et(e,t)}).catch(Ie)):e._pullAgain=!0)}function kt(e){var t=e._controlledReadableStream;return!1!==xt(e)&&!1!==e._started&&(!0===et(t)&&ut(t)>0||Pt(e)>0)}function At(e){var t=e._controlledReadableStream;e._closeRequested=!0,0===e._queue.length&&it(t)}function St(e,t){var r=e._controlledReadableStream;if(!0===et(r)&&ut(r)>0)st(r,t,!1);else{var n;try{n=e._strategySizeAlgorithm(t)}catch(t){throw Et(e,t),t}try{Te(e,t,n)}catch(t){throw Et(e,t),t}}vt(e)}function Et(e,t){var r=e._controlledReadableStream;"readable"===r._state&&(ze(e),at(r,t))}function Pt(e){var t=e._controlledReadableStream._state;return"errored"===t?null:"closed"===t?0:e._strategyHWM-e._queueTotalSize}function xt(e){var t=e._controlledReadableStream._state;return!1===e._closeRequested&&"readable"===t}function Mt(e,t,r,n,i,a,s){t._controlledReadableStream=e,t._queue=void 0,t._queueTotalSize=void 0,ze(t),t._started=!1,t._closeRequested=!1,t._pullAgain=!1,t._pulling=!1,t._strategySizeAlgorithm=s,t._strategyHWM=a,t._pullAlgorithm=n,t._cancelAlgorithm=i,e._readableStreamController=t;var o=r();Promise.resolve(o).then(function(){t._started=!0,vt(t)},function(e){Et(t,e)}).catch(Ie)}var Ct=function(){function e(){throw new TypeError("ReadableStreamBYOBRequest cannot be used directly")}var t=e.prototype;return t.respond=function(e){if(!1===Bt(this))throw er("respond");if(void 0===this._associatedReadableByteStreamController)throw new TypeError("This BYOB request has been invalidated");if(!0===Me(this._view.buffer))throw new TypeError("The BYOB request's buffer has been detached and so cannot be used as a response");!function(e,t){if(t=Number(t),!1===Pe(t))throw new RangeError("bytesWritten must be a finite");Lt(e,t)}(this._associatedReadableByteStreamController,e)},t.respondWithNewView=function(e){if(!1===Bt(this))throw er("respond");if(void 0===this._associatedReadableByteStreamController)throw new TypeError("This BYOB request has been invalidated");if(!ArrayBuffer.isView(e))throw new TypeError("You can only respond with array buffer views");if(!0===Me(e.buffer))throw new TypeError("The supplied view's buffer has been detached and so cannot be used as a response");!function(e,t){var r=e._pendingPullIntos[0];if(r.byteOffset+r.bytesFilled!==t.byteOffset)throw new RangeError("The region specified by view does not match byobRequest");if(r.byteLength!==t.byteLength)throw new RangeError("The buffer of view has different capacity than byobRequest");r.buffer=t.buffer,Lt(e,t.byteLength)}(this._associatedReadableByteStreamController,e)},n(e,[{key:"view",get:function(){if(!1===Bt(this))throw er("view");return this._view}}]),e}(),jt=function(){function e(){throw new TypeError("ReadableByteStreamController constructor cannot be used directly")}var t=e.prototype;return t.close=function(){if(!1===Rt(this))throw tr("close");if(!0===this._closeRequested)throw new TypeError("The stream has already been closed; do not close it again!");var e=this._controlledReadableByteStream._state;if("readable"!==e)throw new TypeError("The stream (in "+e+" state) is not in the readable state and cannot be closed");!function(e){var t=e._controlledReadableByteStream;if(e._queueTotalSize>0)e._closeRequested=!0;else{if(e._pendingPullIntos.length>0)if(e._pendingPullIntos[0].bytesFilled>0){var r=new TypeError("Insufficient bytes to fill elements in the given buffer");throw Ht(e,r),r}it(t)}}(this)},t.enqueue=function(e){if(!1===Rt(this))throw tr("enqueue");if(!0===this._closeRequested)throw new TypeError("stream is closed or draining");var t=this._controlledReadableByteStream._state;if("readable"!==t)throw new TypeError("The stream (in "+t+" state) is not in the readable state and cannot be enqueued to");if(!ArrayBuffer.isView(e))throw new TypeError("You can only enqueue array buffer views when using a ReadableByteStreamController");if(!0===Me(e.buffer))throw new TypeError("Cannot enqueue a view onto a detached ArrayBuffer");!function(e,t){var r=e._controlledReadableByteStream,n=t.buffer,i=t.byteOffset,a=t.byteLength,s=Ce(n);if(!0===ft(r))if(0===ut(r))zt(e,s,i,a);else{st(r,new Uint8Array(s,i,a),!1)}else!0===ct(r)?(zt(e,s,i,a),Ft(e)):zt(e,s,i,a);Kt(e)}(this,e)},t.error=function(e){if(!1===Rt(this))throw tr("error");Ht(this,e)},t[Ze]=function(e){return this._pendingPullIntos.length>0&&(this._pendingPullIntos[0].bytesFilled=0),ze(this),this._cancelAlgorithm(e)},t[Ge]=function(){var e=this._controlledReadableByteStream;if(this._queueTotalSize>0){var t,r=this._queue.shift();this._queueTotalSize-=r.byteLength,Nt(this);try{t=new Uint8Array(r.buffer,r.byteOffset,r.byteLength)}catch(e){return Promise.reject(e)}return Promise.resolve(Ee(t,!1))}var n=this._autoAllocateChunkSize;if(void 0!==n){var i;try{i=new ArrayBuffer(n)}catch(e){return Promise.reject(e)}var a={buffer:i,byteOffset:0,byteLength:n,bytesFilled:0,elementSize:1,ctor:Uint8Array,readerType:"default"};this._pendingPullIntos.push(a)}var s=rt(e);return Kt(this),s},n(e,[{key:"byobRequest",get:function(){if(!1===Rt(this))throw tr("byobRequest");if(void 0===this._byobRequest&&this._pendingPullIntos.length>0){var e=this._pendingPullIntos[0],t=new Uint8Array(e.buffer,e.byteOffset+e.bytesFilled,e.byteLength-e.bytesFilled),r=Object.create(Ct.prototype);!function(e,t,r){e._associatedReadableByteStreamController=t,e._view=r}(r,this,t),this._byobRequest=r}return this._byobRequest}},{key:"desiredSize",get:function(){if(!1===Rt(this))throw tr("desiredSize");return Zt(this)}}]),e}();function Rt(e){return!!Ke(e)&&!!Object.prototype.hasOwnProperty.call(e,"_controlledReadableByteStream")}function Bt(e){return!!Ke(e)&&!!Object.prototype.hasOwnProperty.call(e,"_associatedReadableByteStreamController")}function Kt(e){!1!==function(e){var t=e._controlledReadableByteStream;return"readable"===t._state&&(!0!==e._closeRequested&&(!1!==e._started&&(!0===ft(t)&&ut(t)>0||(!0===ct(t)&&ot(t)>0||Zt(e)>0))))}(e)&&(!0!==e._pulling?(e._pulling=!0,e._pullAlgorithm().then(function(){e._pulling=!1,!0===e._pullAgain&&(e._pullAgain=!1,Kt(e))},function(t){Ht(e,t)}).catch(Ie)):e._pullAgain=!0)}function It(e){qt(e),e._pendingPullIntos=[]}function Ut(e,t){var r=!1;"closed"===e._state&&(r=!0);var n=Tt(t);"default"===t.readerType?st(e,n,r):function(e,t,r){e._reader._readIntoRequests.shift()._resolve(Ee(t,r))}(e,n,r)}function Tt(e){var t=e.bytesFilled,r=e.elementSize;return new e.ctor(e.buffer,e.byteOffset,t/r)}function zt(e,t,r,n){e._queue.push({buffer:t,byteOffset:r,byteLength:n}),e._queueTotalSize+=n}function Ot(e,t){var r=t.elementSize,n=t.bytesFilled-t.bytesFilled%r,i=Math.min(e._queueTotalSize,t.byteLength-t.bytesFilled),a=t.bytesFilled+i,s=a-a%r,o=i,u=!1;s>n&&(o=s-t.bytesFilled,u=!0);for(var c=e._queue;o>0;){var f=c[0],d=Math.min(o,f.byteLength),l=t.byteOffset+t.bytesFilled;Ae(t.buffer,l,f.buffer,f.byteOffset,d),f.byteLength===d?c.shift():(f.byteOffset+=d,f.byteLength-=d),e._queueTotalSize-=d,Dt(e,d,t),o-=d}return u}function Dt(e,t,r){qt(e),r.bytesFilled+=t}function Nt(e){0===e._queueTotalSize&&!0===e._closeRequested?it(e._controlledReadableByteStream):Kt(e)}function qt(e){void 0!==e._byobRequest&&(e._byobRequest._associatedReadableByteStreamController=void 0,e._byobRequest._view=void 0,e._byobRequest=void 0)}function Ft(e){for(;e._pendingPullIntos.length>0;){if(0===e._queueTotalSize)return;var t=e._pendingPullIntos[0];!0===Ot(e,t)&&(Wt(e),Ut(e._controlledReadableByteStream,t))}}function Lt(e,t){var r=e._pendingPullIntos[0];if("closed"===e._controlledReadableByteStream._state){if(0!==t)throw new TypeError("bytesWritten must be 0 when calling respond() on a closed stream");!function(e,t){t.buffer=Ce(t.buffer);var r=e._controlledReadableByteStream;if(!0===ct(r))for(;ot(r)>0;)Ut(r,Wt(e))}(e,r)}else!function(e,t,r){if(r.bytesFilled+t>r.byteLength)throw new RangeError("bytesWritten out of range");if(Dt(e,t,r),!(r.bytesFilled<r.elementSize)){Wt(e);var n=r.bytesFilled%r.elementSize;if(n>0){var i=r.byteOffset+r.bytesFilled,a=r.buffer.slice(i-n,i);zt(e,a,0,a.byteLength)}r.buffer=Ce(r.buffer),r.bytesFilled-=n,Ut(e._controlledReadableByteStream,r),Ft(e)}}(e,t,r);Kt(e)}function Wt(e){var t=e._pendingPullIntos.shift();return qt(e),t}function Ht(e,t){var r=e._controlledReadableByteStream;"readable"===r._state&&(It(e),ze(e),at(r,t))}function Zt(e){var t=e._controlledReadableByteStream._state;return"errored"===t?null:"closed"===t?0:e._strategyHWM-e._queueTotalSize}function Gt(e,t,r,n,i,a,s){t._controlledReadableByteStream=e,t._pullAgain=!1,t._pulling=!1,It(t),t._queue=t._queueTotalSize=void 0,ze(t),t._closeRequested=!1,t._started=!1,t._strategyHWM=je(a),t._pullAlgorithm=n,t._cancelAlgorithm=i,t._autoAllocateChunkSize=s,t._pendingPullIntos=[],e._readableStreamController=t;var o=r();Promise.resolve(o).then(function(){t._started=!0,Kt(t)},function(e){Ht(t,e)}).catch(Ie)}function Vt(e){return new TypeError("ReadableStream.prototype."+e+" can only be used on a ReadableStream")}function Yt(e){return new TypeError("Cannot "+e+" a stream using a released reader")}function Xt(e){return new TypeError("ReadableStreamDefaultReader.prototype."+e+" can only be used on a ReadableStreamDefaultReader")}function $t(e,t){e._closedPromise_reject(t),e._closedPromise_resolve=void 0,e._closedPromise_reject=void 0}function Jt(e){return new TypeError("ReadableStreamBYOBReader.prototype."+e+" can only be used on a ReadableStreamBYOBReader")}function Qt(e){return new TypeError("ReadableStreamDefaultController.prototype."+e+" can only be used on a ReadableStreamDefaultController")}function er(e){return new TypeError("ReadableStreamBYOBRequest.prototype."+e+" can only be used on a ReadableStreamBYOBRequest")}function tr(e){return new TypeError("ReadableByteStreamController.prototype."+e+" can only be used on a ReadableByteStreamController")}var rr=Ye.ReadableStream,nr=g.createDataProperty,ir=function(){function e(e){var t=e.highWaterMark;nr(this,"highWaterMark",t)}return e.prototype.size=function(e){return e.byteLength},e}(),ar=g.createDataProperty,sr=function(){function e(e){var t=e.highWaterMark;ar(this,"highWaterMark",t)}return e.prototype.size=function(){return 1},e}(),or=(x("streams:transform-stream:verbose"),g.InvokeOrNoop),ur=g.CreateAlgorithmFromUnderlyingMethod,cr=g.PromiseCall,fr=g.typeIsObject,dr=g.ValidateAndNormalizeHighWaterMark,lr=(g.IsNonNegativeNumber,g.MakeSizeAlgorithmFromSizeFunction),hr=Ye.CreateReadableStream,pr=Ye.ReadableStreamDefaultControllerClose,yr=Ye.ReadableStreamDefaultControllerEnqueue,br=Ye.ReadableStreamDefaultControllerError,mr=Ye.ReadableStreamDefaultControllerGetDesiredSize,gr=Ye.ReadableStreamDefaultControllerHasBackpressure,wr=Ye.ReadableStreamDefaultControllerCanCloseOrEnqueue,_r=L.CreateWritableStream,vr=L.WritableStreamDefaultControllerErrorIfNeeded,kr=function(){function e(e,t,r){if(void 0===e&&(e={}),void 0===t&&(t={}),void 0===r&&(r={}),void 0!==e.readableType)throw new RangeError("Invalid readable type specified");if(void 0!==e.writableType)throw new RangeError("Invalid writable type specified");var n=t.size,i=lr(n),a=t.highWaterMark;void 0===a&&(a=1),a=dr(a);var s,o=r.size,u=lr(o),c=r.highWaterMark;void 0===c&&(c=0),c=dr(c),Ar(this,new Promise(function(e){s=e}),a,i,c,u),function(e,t){var r=Object.create(Mr.prototype),n=function(e){try{return Rr(r,e),Promise.resolve()}catch(e){return Promise.reject(e)}},i=t.transform;if(void 0!==i){if("function"!=typeof i)throw new TypeError("transform is not a method");n=function(n){return cr(i,t,[n,r]).catch(function(t){throw Er(e,t),t})}}var a=ur(t,"flush",0,[r]);jr(e,r,n,a)}(this,e);var f=or(e,"start",[this._transformStreamController]);s(f)}return n(e,[{key:"readable",get:function(){if(!1===Sr(this))throw Kr("readable");return this._readable}},{key:"writable",get:function(){if(!1===Sr(this))throw Kr("writable");return this._writable}}]),e}();function Ar(e,t,r,n,i,a){function s(){return t}e._writable=_r(s,function(t){return function(e,t){var r=e._transformStreamController;return!0===e._backpressure?e._backpressureChangePromise.then(function(){var n=e._writable;if("erroring"===n._state)throw n._storedError;return r._transformAlgorithm(t)}):r._transformAlgorithm(t)}(e,t)},function(){return function(e){var t=e._readable;return e._transformStreamController._flushAlgorithm().then(function(){if("errored"===t._state)throw t._storedError;var e=t._readableStreamController;!0===wr(e)&&pr(e)}).catch(function(r){throw Er(e,r),t._storedError})}(e)},function(t){return function(e,t){return Er(e,t),Promise.resolve()}(e,t)},r,n),e._readable=hr(s,function(){return function(e){return xr(e,!1),e._backpressureChangePromise}(e)},function(t){return Pr(e,t),Promise.resolve()},i,a),e._backpressure=void 0,e._backpressureChangePromise=void 0,e._backpressureChangePromise_resolve=void 0,xr(e,!0),e._transformStreamController=void 0}function Sr(e){return!!fr(e)&&!!Object.prototype.hasOwnProperty.call(e,"_transformStreamController")}function Er(e,t){br(e._readable._readableStreamController,t),Pr(e,t)}function Pr(e,t){vr(e._writable._writableStreamController,t),!0===e._backpressure&&xr(e,!1)}function xr(e,t){void 0!==e._backpressureChangePromise&&e._backpressureChangePromise_resolve(),e._backpressureChangePromise=new Promise(function(t){e._backpressureChangePromise_resolve=t}),e._backpressure=t}var Mr=function(){function e(){throw new TypeError("TransformStreamDefaultController instances cannot be created directly")}var t=e.prototype;return t.enqueue=function(e){if(!1===Cr(this))throw Br("enqueue");Rr(this,e)},t.error=function(e){if(!1===Cr(this))throw Br("error");!function(e,t){Er(e._controlledTransformStream,t)}(this,e)},t.terminate=function(){if(!1===Cr(this))throw Br("terminate");var e,t;e=this._controlledTransformStream,t=e._readable._readableStreamController,!0===wr(t)&&pr(t),Pr(e,new TypeError("TransformStream terminated"))},n(e,[{key:"desiredSize",get:function(){if(!1===Cr(this))throw Br("desiredSize");var e=this._controlledTransformStream._readable._readableStreamController;return mr(e)}}]),e}();function Cr(e){return!!fr(e)&&!!Object.prototype.hasOwnProperty.call(e,"_controlledTransformStream")}function jr(e,t,r,n){t._controlledTransformStream=e,e._transformStreamController=t,t._transformAlgorithm=r,t._flushAlgorithm=n}function Rr(e,t){var r=e._controlledTransformStream,n=r._readable._readableStreamController;if(!1===wr(n))throw new TypeError("Readable side is not in a state that permits enqueue");try{yr(n,t)}catch(e){throw Pr(r,e),r._readable._storedError}gr(n)!==r._backpressure&&xr(r,!0)}function Br(e){return new TypeError("TransformStreamDefaultController.prototype."+e+" can only be used on a TransformStreamDefaultController")}function Kr(e){return new TypeError("TransformStream.prototype."+e+" can only be used on a TransformStream")}var Ir=kr;void 0!==u&&i(u,{ReadableStream:rr,WritableStream:ke,ByteLengthQueuingStrategy:ir,CountQueuingStrategy:sr,TransformStream:Ir}),t.ReadableStream=rr,t.WritableStream=ke,t.ByteLengthQueuingStrategy=ir,t.CountQueuingStrategy=sr,t.TransformStream=Ir,Object.defineProperty(t,"__esModule",{value:!0})}("object"==typeof r&&void 0!==t?r:n.WebStreamsPolyfill={})}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],2:[function(e,t,r){"use strict";const n=e("email-addresses");function i(e){if("group"===e.type)return new a(e.name,e.addresses.map(i));let t;e.parts.comments&&(t=e.parts.comments.map(function(e){return e.tokens.trim()}).join(" ").trim());let r=e.local;return!e.name&&/:/.test(r)&&(r='"'+r+'"'),new s(e.name,r+"@"+e.domain,t)}r.parse=function(e,t){if(!e)throw"Nothing to parse";e=e.trim();const r=n({input:e,rfc6532:!0,partial:!1,simple:!1,strict:!1,rejectTLD:!1,startAt:t||null});if(!r)throw"No results";return r.addresses.map(i)},r.parseFrom=function(e){return r.parse(e,"from")},r.parseSender=function(e){return r.parse(e,"sender")},r.parseReplyTo=function(e){return r.parse(e,"reply-to")};class a{constructor(e,t){this.phrase=e,this.addresses=t}format(){return this.phrase+":"+this.addresses.map(function(e){return e.format()}).join(",")}name(){let e=this.phrase;return e&&e.length||(e=this.comment),o(e)}}class s{constructor(e,t,r){this.phrase=e||"",this.address=t||"",this.comment=r||""}host(){const e=/.*@(.*)$/.exec(this.address);return e?e[1]:null}user(){const e=/^(.*)@/.exec(this.address);return e?e[1]:null}format(){const e=this.phrase,t=this.address;let r=this.comment;const n=[],i=new RegExp("^[\\-\\w !#$%&'*+/=?^`{|}~]+$");return e&&e.length?(n.push(i.test(e.trim())?e:function(e){if(/^"/.test(e))return!0;let t;for(;t=/^[\s\S]*?([\s\S])"/.exec(e);){if("\\"!==t[1])return!0;e=e.substr(t[0].length)}return!1}(e)?e:'"'+e+'"'),t&&t.length&&n.push("<"+t+">")):t&&t.length&&n.push(t),r&&/\S/.test(r)&&(r=r.replace(/^\s*\(?/,"(").replace(/\)?\s*$/,")")),r&&r.length&&n.push(r),n.join(" ")}name(){let e=this.phrase;const t=this.address;e&&e.length||(e=this.comment);let r=o(e);if(""===r){const e=/([^%.@_]+([._][^%.@_]+)+)[@%]/.exec(t);e&&(r=o(r=e[1].replace(/[._]+/g," ")))}if(""===r&&/\/g=/i.test(t)){let e=/\/g=([^\/]*)/i.exec(t);r=o(e[1]+" "+(e=/\/s=([^\/]*)/i.exec(t))[1])}return r}}function o(e){return/=?.*?\?=/.test(e)?"":(e=(e=e.trim()).replace(/\s+/," "),/^[\d ]+$/.test(e)?"":(e=e.replace(/^\((.*)\)$/,"$1").replace(/^"(.*)"$/,"$1").replace(/\(.*?\)/g,"").replace(/\\/g,"").replace(/^"(.*)"$/,"$1").replace(/^([^\s]+) ?, ?(.*)$/,"$2 $1").replace(/,.*/,""),(r.isAllUpper(e)||r.isAllLower(e))&&(e=r.nameCase(e)),e=e.replace(/\[[^\]]*\]/g,"").replace(/(^[\s'"]+|[\s'"]+$)/g,"").replace(/\s{2,}/g," ")))}r.Address=s,r.isAllLower=function(e){return e===e.toLowerCase()},r.isAllUpper=function(e){return e===e.toUpperCase()},r.nameCase=function(e){return e.toLowerCase().replace(/\b(\w+)/g,function(e,t){return t.charAt(0).toUpperCase()+t.slice(1)}).replace(/\bMc(\w)/gi,function(e,t){return"Mc"+t.toUpperCase()}).replace(/\bo'(\w)/gi,function(e,t){return"O'"+t.toUpperCase()}).replace(/\b(x*(ix)?v*(iv)?i*)\b/gi,function(e,t){return t.toUpperCase()})}},{"email-addresses":35}],3:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});r.AES_asm=function(){var e,t,r=!1;function n(r,n){var i=e[(t[r]+t[n])%255];return 0!==r&&0!==n||(i=0),i}var i,a,s,o,u=!1;function c(){function c(r){var n,i,a;for(i=a=function(r){var n=e[255-t[r]];return 0===r&&(n=0),n}(r),n=0;n<4;n++)a^=i=255&(i<<1|i>>>7);return a^=99}r||function(){e=[],t=[];var n,i,a=1;for(n=0;n<255;n++)e[n]=a,i=128&a,a<<=1,a&=255,128===i&&(a^=27),a^=e[n],t[e[n]]=n;e[255]=e[0],t[0]=0,r=!0}(),i=[],a=[],s=[[],[],[],[]],o=[[],[],[],[]];for(var f=0;f<256;f++){var d=c(f);i[f]=d,a[d]=f,s[0][f]=n(2,d)<<24|d<<16|d<<8|n(3,d),o[0][d]=n(14,f)<<24|n(9,f)<<16|n(13,f)<<8|n(11,f);for(var l=1;l<4;l++)s[l][f]=s[l-1][f]>>>8|s[l-1][f]<<24,o[l][d]=o[l-1][d]>>>8|o[l-1][d]<<24}u=!0}var f=function(e,t){u||c();var r=new Uint32Array(t);r.set(i,512),r.set(a,768);for(var n=0;n<4;n++)r.set(s[n],4096+1024*n>>2),r.set(o[n],8192+1024*n>>2);var f=function(e,t,r){"use asm";var n=0,i=0,a=0,s=0,o=0,u=0,c=0,f=0,d=0,l=0,h=0,p=0,y=0,b=0,m=0,g=0,w=0,_=0,v=0,k=0,A=0;var S=new e.Uint32Array(r),E=new e.Uint8Array(r);function P(e,t,r,o,u,c,f,d){e=e|0;t=t|0;r=r|0;o=o|0;u=u|0;c=c|0;f=f|0;d=d|0;var l=0,h=0,p=0,y=0,b=0,m=0,g=0,w=0;l=r|0x400,h=r|0x800,p=r|0xc00;u=u^S[(e|0)>>2],c=c^S[(e|4)>>2],f=f^S[(e|8)>>2],d=d^S[(e|12)>>2];for(w=16;(w|0)<=o<<4;w=w+16|0){y=S[(r|u>>22&1020)>>2]^S[(l|c>>14&1020)>>2]^S[(h|f>>6&1020)>>2]^S[(p|d<<2&1020)>>2]^S[(e|w|0)>>2],b=S[(r|c>>22&1020)>>2]^S[(l|f>>14&1020)>>2]^S[(h|d>>6&1020)>>2]^S[(p|u<<2&1020)>>2]^S[(e|w|4)>>2],m=S[(r|f>>22&1020)>>2]^S[(l|d>>14&1020)>>2]^S[(h|u>>6&1020)>>2]^S[(p|c<<2&1020)>>2]^S[(e|w|8)>>2],g=S[(r|d>>22&1020)>>2]^S[(l|u>>14&1020)>>2]^S[(h|c>>6&1020)>>2]^S[(p|f<<2&1020)>>2]^S[(e|w|12)>>2];u=y,c=b,f=m,d=g}n=S[(t|u>>22&1020)>>2]<<24^S[(t|c>>14&1020)>>2]<<16^S[(t|f>>6&1020)>>2]<<8^S[(t|d<<2&1020)>>2]^S[(e|w|0)>>2],i=S[(t|c>>22&1020)>>2]<<24^S[(t|f>>14&1020)>>2]<<16^S[(t|d>>6&1020)>>2]<<8^S[(t|u<<2&1020)>>2]^S[(e|w|4)>>2],a=S[(t|f>>22&1020)>>2]<<24^S[(t|d>>14&1020)>>2]<<16^S[(t|u>>6&1020)>>2]<<8^S[(t|c<<2&1020)>>2]^S[(e|w|8)>>2],s=S[(t|d>>22&1020)>>2]<<24^S[(t|u>>14&1020)>>2]<<16^S[(t|c>>6&1020)>>2]<<8^S[(t|f<<2&1020)>>2]^S[(e|w|12)>>2]}function x(e,t,r,n){e=e|0;t=t|0;r=r|0;n=n|0;P(0x0000,0x0800,0x1000,A,e,t,r,n)}function M(e,t,r,n){e=e|0;t=t|0;r=r|0;n=n|0;var a=0;P(0x0400,0x0c00,0x2000,A,e,n,r,t);a=i,i=s,s=a}function C(e,t,r,d){e=e|0;t=t|0;r=r|0;d=d|0;P(0x0000,0x0800,0x1000,A,o^e,u^t,c^r,f^d);o=n,u=i,c=a,f=s}function j(e,t,r,d){e=e|0;t=t|0;r=r|0;d=d|0;var l=0;P(0x0400,0x0c00,0x2000,A,e,d,r,t);l=i,i=s,s=l;n=n^o,i=i^u,a=a^c,s=s^f;o=e,u=t,c=r,f=d}function R(e,t,r,d){e=e|0;t=t|0;r=r|0;d=d|0;P(0x0000,0x0800,0x1000,A,o,u,c,f);o=n=n^e,u=i=i^t,c=a=a^r,f=s=s^d}function B(e,t,r,d){e=e|0;t=t|0;r=r|0;d=d|0;P(0x0000,0x0800,0x1000,A,o,u,c,f);n=n^e,i=i^t,a=a^r,s=s^d;o=e,u=t,c=r,f=d}function K(e,t,r,d){e=e|0;t=t|0;r=r|0;d=d|0;P(0x0000,0x0800,0x1000,A,o,u,c,f);o=n,u=i,c=a,f=s;n=n^e,i=i^t,a=a^r,s=s^d}function I(e,t,r,o){e=e|0;t=t|0;r=r|0;o=o|0;P(0x0000,0x0800,0x1000,A,d,l,h,p);p=~g&p|g&p+1;h=~m&h|m&h+((p|0)==0);l=~b&l|b&l+((h|0)==0);d=~y&d|y&d+((l|0)==0);n=n^e;i=i^t;a=a^r;s=s^o}function U(e,t,r,n){e=e|0;t=t|0;r=r|0;n=n|0;var i=0,a=0,s=0,d=0,l=0,h=0,p=0,y=0,b=0,m=0;e=e^o,t=t^u,r=r^c,n=n^f;i=w|0,a=_|0,s=v|0,d=k|0;for(;(b|0)<128;b=b+1|0){if(i>>>31){l=l^e,h=h^t,p=p^r,y=y^n}i=i<<1|a>>>31,a=a<<1|s>>>31,s=s<<1|d>>>31,d=d<<1;m=n&1;n=n>>>1|r<<31,r=r>>>1|t<<31,t=t>>>1|e<<31,e=e>>>1;if(m)e=e^0xe1000000}o=l,u=h,c=p,f=y}function T(e){e=e|0;A=e}function z(e,t,r,o){e=e|0;t=t|0;r=r|0;o=o|0;n=e,i=t,a=r,s=o}function O(e,t,r,n){e=e|0;t=t|0;r=r|0;n=n|0;o=e,u=t,c=r,f=n}function D(e,t,r,n){e=e|0;t=t|0;r=r|0;n=n|0;d=e,l=t,h=r,p=n}function N(e,t,r,n){e=e|0;t=t|0;r=r|0;n=n|0;y=e,b=t,m=r,g=n}function q(e,t,r,n){e=e|0;t=t|0;r=r|0;n=n|0;p=~g&p|g&n,h=~m&h|m&r,l=~b&l|b&t,d=~y&d|y&e}function F(e){e=e|0;if(e&15)return-1;E[e|0]=n>>>24,E[e|1]=n>>>16&255,E[e|2]=n>>>8&255,E[e|3]=n&255,E[e|4]=i>>>24,E[e|5]=i>>>16&255,E[e|6]=i>>>8&255,E[e|7]=i&255,E[e|8]=a>>>24,E[e|9]=a>>>16&255,E[e|10]=a>>>8&255,E[e|11]=a&255,E[e|12]=s>>>24,E[e|13]=s>>>16&255,E[e|14]=s>>>8&255,E[e|15]=s&255;return 16}function L(e){e=e|0;if(e&15)return-1;E[e|0]=o>>>24,E[e|1]=o>>>16&255,E[e|2]=o>>>8&255,E[e|3]=o&255,E[e|4]=u>>>24,E[e|5]=u>>>16&255,E[e|6]=u>>>8&255,E[e|7]=u&255,E[e|8]=c>>>24,E[e|9]=c>>>16&255,E[e|10]=c>>>8&255,E[e|11]=c&255,E[e|12]=f>>>24,E[e|13]=f>>>16&255,E[e|14]=f>>>8&255,E[e|15]=f&255;return 16}function W(){x(0,0,0,0);w=n,_=i,v=a,k=s}function H(e,t,r){e=e|0;t=t|0;r=r|0;var o=0;if(t&15)return-1;while((r|0)>=16){G[e&7](E[t|0]<<24|E[t|1]<<16|E[t|2]<<8|E[t|3],E[t|4]<<24|E[t|5]<<16|E[t|6]<<8|E[t|7],E[t|8]<<24|E[t|9]<<16|E[t|10]<<8|E[t|11],E[t|12]<<24|E[t|13]<<16|E[t|14]<<8|E[t|15]);E[t|0]=n>>>24,E[t|1]=n>>>16&255,E[t|2]=n>>>8&255,E[t|3]=n&255,E[t|4]=i>>>24,E[t|5]=i>>>16&255,E[t|6]=i>>>8&255,E[t|7]=i&255,E[t|8]=a>>>24,E[t|9]=a>>>16&255,E[t|10]=a>>>8&255,E[t|11]=a&255,E[t|12]=s>>>24,E[t|13]=s>>>16&255,E[t|14]=s>>>8&255,E[t|15]=s&255;o=o+16|0,t=t+16|0,r=r-16|0}return o|0}function Z(e,t,r){e=e|0;t=t|0;r=r|0;var n=0;if(t&15)return-1;while((r|0)>=16){V[e&1](E[t|0]<<24|E[t|1]<<16|E[t|2]<<8|E[t|3],E[t|4]<<24|E[t|5]<<16|E[t|6]<<8|E[t|7],E[t|8]<<24|E[t|9]<<16|E[t|10]<<8|E[t|11],E[t|12]<<24|E[t|13]<<16|E[t|14]<<8|E[t|15]);n=n+16|0,t=t+16|0,r=r-16|0}return n|0}var G=[x,M,C,j,R,B,K,I];var V=[C,U];return{set_rounds:T,set_state:z,set_iv:O,set_nonce:D,set_mask:N,set_counter:q,get_state:F,get_iv:L,gcm_init:W,cipher:H,mac:Z}}({Uint8Array:Uint8Array,Uint32Array:Uint32Array},e,t);return f.set_key=function(e,t,n,a,s,u,c,d,l){var h=r.subarray(0,60),p=r.subarray(256,316);h.set([t,n,a,s,u,c,d,l]);for(var y=e,b=1;y<4*e+28;y++){var m=h[y-1];(y%e==0||8===e&&y%e==4)&&(m=i[m>>>24]<<24^i[m>>>16&255]<<16^i[m>>>8&255]<<8^i[255&m]),y%e==0&&(m=m<<8^m>>>24^b<<24,b=b<<1^(128&b?27:0)),h[y]=h[y-e]^m}for(var g=0;g<y;g+=4)for(var w=0;w<4;w++)m=h[y-(4+g)+(4-w)%4],p[g+w]=g<4||g>=y-4?m:o[0][i[m>>>24]]^o[1][i[m>>>16&255]]^o[2][i[m>>>8&255]]^o[3][i[255&m]];f.set_rounds(e+5)},f};return f.ENC={ECB:0,CBC:2,CFB:4,OFB:6,CTR:7},f.DEC={ECB:1,CBC:3,CFB:5,OFB:6,CTR:7},f.MAC={CBC:0,GCM:1},f.HEAP_DATA=16384,f}()},{}],4:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.AES=void 0;var n=e("./aes.asm"),i=e("../other/utils"),a=e("../other/errors"),s=[],o=[],u=function(){function e(e,t,r,n){void 0===r&&(r=!0),this.pos=0,this.len=0,this.mode=n,this.pos=0,this.len=0,this.key=e,this.iv=t,this.padding=r,this.acquire_asm()}return e.prototype.acquire_asm=function(){void 0===this.heap&&void 0===this.asm&&(this.heap=s.pop()||(0,i._heap_init)().subarray(n.AES_asm.HEAP_DATA),this.asm=o.pop()||(0,n.AES_asm)(null,this.heap.buffer),this.reset(this.key,this.iv))},e.prototype.release_asm=function(){s.push(this.heap),o.push(this.asm),this.heap=void 0,this.asm=void 0},e.prototype.reset=function(e,t){var r=e.length;if(16!==r&&24!==r&&32!==r)throw new a.IllegalArgumentError("illegal key size");var n=new DataView(e.buffer,e.byteOffset,e.byteLength);if(this.asm.set_key(r>>2,n.getUint32(0),n.getUint32(4),n.getUint32(8),n.getUint32(12),r>16?n.getUint32(16):0,r>16?n.getUint32(20):0,r>24?n.getUint32(24):0,r>24?n.getUint32(28):0),void 0!==t){if(16!==t.length)throw new a.IllegalArgumentError("illegal iv size");var i=new DataView(t.buffer,t.byteOffset,t.byteLength);this.asm.set_iv(i.getUint32(0),i.getUint32(4),i.getUint32(8),i.getUint32(12))}else this.asm.set_iv(0,0,0,0)},e.prototype.AES_Encrypt_process=function(e){if(!(0,i.is_bytes)(e))throw new TypeError("data isn't of expected type");this.acquire_asm();for(var t=this.asm,r=this.heap,a=n.AES_asm.ENC[this.mode],s=n.AES_asm.HEAP_DATA,o=this.pos,u=this.len,c=0,f=e.length||0,d=0,l=0,h=new Uint8Array(u+f&-16);f>0;)u+=l=(0,i._heap_write)(r,o+u,e,c,f),c+=l,f-=l,(l=t.cipher(a,s+o,u))&&h.set(r.subarray(o,o+l),d),d+=l,l<u?(o+=l,u-=l):(o=0,u=0);return this.pos=o,this.len=u,h},e.prototype.AES_Encrypt_finish=function(){this.acquire_asm();var e=this.asm,t=this.heap,r=n.AES_asm.ENC[this.mode],i=n.AES_asm.HEAP_DATA,s=this.pos,o=this.len,u=16-o%16,c=o;if(this.hasOwnProperty("padding")){if(this.padding){for(var f=0;f<u;++f)t[s+o+f]=u;c=o+=u}else if(o%16)throw new a.IllegalArgumentError("data length must be a multiple of the block size")}else o+=u;var d=new Uint8Array(c);return o&&e.cipher(r,i+s,o),c&&d.set(t.subarray(s,s+c)),this.pos=0,this.len=0,this.release_asm(),d},e.prototype.AES_Decrypt_process=function(e){if(!(0,i.is_bytes)(e))throw new TypeError("data isn't of expected type");this.acquire_asm();var t=this.asm,r=this.heap,a=n.AES_asm.DEC[this.mode],s=n.AES_asm.HEAP_DATA,o=this.pos,u=this.len,c=0,f=e.length||0,d=0,l=u+f&-16,h=0,p=0;this.padding&&(l-=h=u+f-l||16);for(var y=new Uint8Array(l);f>0;)u+=p=(0,i._heap_write)(r,o+u,e,c,f),c+=p,f-=p,(p=t.cipher(a,s+o,u-(f?0:h)))&&y.set(r.subarray(o,o+p),d),d+=p,p<u?(o+=p,u-=p):(o=0,u=0);return this.pos=o,this.len=u,y},e.prototype.AES_Decrypt_finish=function(){this.acquire_asm();var e=this.asm,t=this.heap,r=n.AES_asm.DEC[this.mode],i=n.AES_asm.HEAP_DATA,s=this.pos,o=this.len,u=o;if(o>0){if(o%16){if(this.hasOwnProperty("padding"))throw new a.IllegalArgumentError("data length must be a multiple of the block size");o+=16-o%16}if(e.cipher(r,i+s,o),this.hasOwnProperty("padding")&&this.padding){var c=t[s+u-1];if(c<1||c>16||c>u)throw new a.SecurityError("bad padding");for(var f=0,d=c;d>1;d--)f|=c^t[s+u-d];if(f)throw new a.SecurityError("bad padding");u-=c}}var l=new Uint8Array(u);return u>0&&l.set(t.subarray(s,s+u)),this.pos=0,this.len=0,this.release_asm(),l},e}();r.AES=u},{"../other/errors":15,"../other/utils":16,"./aes.asm":3}],5:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.AES_CBC=void 0;var n,i=e("./aes"),a=e("../other/utils"),s=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=function(e){function t(t,r,n){return void 0===n&&(n=!0),e.call(this,t,r,n,"CBC")||this}return s(t,e),t.encrypt=function(e,r,n,i){return void 0===n&&(n=!0),new t(r,i,n).encrypt(e)},t.decrypt=function(e,r,n,i){return void 0===n&&(n=!0),new t(r,i,n).decrypt(e)},t.prototype.encrypt=function(e){var t=this.AES_Encrypt_process(e),r=this.AES_Encrypt_finish();return(0,a.joinBytes)(t,r)},t.prototype.decrypt=function(e){var t=this.AES_Decrypt_process(e),r=this.AES_Decrypt_finish();return(0,a.joinBytes)(t,r)},t}(i.AES);r.AES_CBC=o},{"../other/utils":16,"./aes":4}],6:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.AES_CFB=void 0;var n,i=e("./aes"),a=e("../other/utils"),s=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=function(e){function t(t,r){var n=e.call(this,t,r,!0,"CFB")||this;return delete n.padding,n}return s(t,e),t.encrypt=function(e,r,n){return new t(r,n).encrypt(e)},t.decrypt=function(e,r,n){return new t(r,n).decrypt(e)},t.prototype.encrypt=function(e){var t=this.AES_Encrypt_process(e),r=this.AES_Encrypt_finish();return(0,a.joinBytes)(t,r)},t.prototype.decrypt=function(e){var t=this.AES_Decrypt_process(e),r=this.AES_Decrypt_finish();return(0,a.joinBytes)(t,r)},t}(i.AES);r.AES_CFB=o},{"../other/utils":16,"./aes":4}],7:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.AES_CTR=void 0;var n,i=e("./aes"),a=e("../other/errors"),s=e("../other/utils"),o=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),u=function(e){function t(t,r){var n=e.call(this,t,void 0,!1,"CTR")||this;return delete n.padding,n.AES_CTR_set_options(r),n}return o(t,e),t.encrypt=function(e,r,n){return new t(r,n).encrypt(e)},t.decrypt=function(e,r,n){return new t(r,n).encrypt(e)},t.prototype.encrypt=function(e){var t=this.AES_Encrypt_process(e),r=this.AES_Encrypt_finish();return(0,s.joinBytes)(t,r)},t.prototype.decrypt=function(e){var t=this.AES_Encrypt_process(e),r=this.AES_Encrypt_finish();return(0,s.joinBytes)(t,r)},t.prototype.AES_CTR_set_options=function(e,t,r){if(void 0!==r){if(r<8||r>48)throw new a.IllegalArgumentError("illegal counter size");var n=Math.pow(2,r)-1;this.asm.set_mask(0,0,n/4294967296|0,0|n)}else r=48,this.asm.set_mask(0,0,65535,4294967295);if(void 0===e)throw new Error("nonce is required");var i=e.length;if(!i||i>16)throw new a.IllegalArgumentError("illegal nonce size");var s=new DataView(new ArrayBuffer(16));if(new Uint8Array(s.buffer).set(e),this.asm.set_nonce(s.getUint32(0),s.getUint32(4),s.getUint32(8),s.getUint32(12)),void 0!==t){if(t<0||t>=Math.pow(2,r))throw new a.IllegalArgumentError("illegal counter value");this.asm.set_counter(0,0,t/4294967296|0,0|t)}},t}(i.AES);r.AES_CTR=u},{"../other/errors":15,"../other/utils":16,"./aes":4}],8:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.AES_ECB=void 0;var n,i=e("./aes"),a=e("../other/utils"),s=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=function(e){function t(t,r){return void 0===r&&(r=!1),e.call(this,t,void 0,r,"ECB")||this}return s(t,e),t.encrypt=function(e,r,n){return void 0===n&&(n=!1),new t(r,n).encrypt(e)},t.decrypt=function(e,r,n){return void 0===n&&(n=!1),new t(r,n).decrypt(e)},t.prototype.encrypt=function(e){var t=this.AES_Encrypt_process(e),r=this.AES_Encrypt_finish();return(0,a.joinBytes)(t,r)},t.prototype.decrypt=function(e){var t=this.AES_Decrypt_process(e),r=this.AES_Decrypt_finish();return(0,a.joinBytes)(t,r)},t}(i.AES);r.AES_ECB=o},{"../other/utils":16,"./aes":4}],9:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.AES_GCM=void 0;var n,i=e("../other/errors"),a=e("../other/utils"),s=e("./aes"),o=e("./aes.asm"),u=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),c=68719476704,f=function(e){function t(t,r,n,a){void 0===a&&(a=16);var s=e.call(this,t,void 0,!1,"CTR")||this;if(s.tagSize=a,s.gamma0=0,s.counter=1,s.asm.gcm_init(),s.tagSize<4||s.tagSize>16)throw new i.IllegalArgumentError("illegal tagSize value");var u=r.length||0,f=new Uint8Array(16);12!==u?(s._gcm_mac_process(r),s.heap[0]=0,s.heap[1]=0,s.heap[2]=0,s.heap[3]=0,s.heap[4]=0,s.heap[5]=0,s.heap[6]=0,s.heap[7]=0,s.heap[8]=0,s.heap[9]=0,s.heap[10]=0,s.heap[11]=u>>>29,s.heap[12]=u>>>21&255,s.heap[13]=u>>>13&255,s.heap[14]=u>>>5&255,s.heap[15]=u<<3&255,s.asm.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA,16),s.asm.get_iv(o.AES_asm.HEAP_DATA),s.asm.set_iv(0,0,0,0),f.set(s.heap.subarray(0,16))):(f.set(r),f[15]=1);var d=new DataView(f.buffer);if(s.gamma0=d.getUint32(12),s.asm.set_nonce(d.getUint32(0),d.getUint32(4),d.getUint32(8),0),s.asm.set_mask(0,0,0,4294967295),void 0!==n){if(n.length>c)throw new i.IllegalArgumentError("illegal adata length");n.length?(s.adata=n,s._gcm_mac_process(n)):s.adata=void 0}else s.adata=void 0;if(s.counter<1||s.counter>4294967295)throw new RangeError("counter must be a positive 32-bit integer");return s.asm.set_counter(0,0,0,s.gamma0+s.counter|0),s}return u(t,e),t.encrypt=function(e,r,n,i,a){return new t(r,n,i,a).encrypt(e)},t.decrypt=function(e,r,n,i,a){return new t(r,n,i,a).decrypt(e)},t.prototype.encrypt=function(e){return this.AES_GCM_encrypt(e)},t.prototype.decrypt=function(e){return this.AES_GCM_decrypt(e)},t.prototype.AES_GCM_Encrypt_process=function(e){var t=0,r=e.length||0,n=this.asm,i=this.heap,s=this.counter,u=this.pos,f=this.len,d=0,l=f+r&-16,h=0;if((s-1<<4)+f+r>c)throw new RangeError("counter overflow");for(var p=new Uint8Array(l);r>0;)f+=h=(0,a._heap_write)(i,u+f,e,t,r),t+=h,r-=h,h=n.cipher(o.AES_asm.ENC.CTR,o.AES_asm.HEAP_DATA+u,f),(h=n.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA+u,h))&&p.set(i.subarray(u,u+h),d),s+=h>>>4,d+=h,h<f?(u+=h,f-=h):(u=0,f=0);return this.counter=s,this.pos=u,this.len=f,p},t.prototype.AES_GCM_Encrypt_finish=function(){var e=this.asm,t=this.heap,r=this.counter,n=this.tagSize,i=this.adata,a=this.pos,s=this.len,u=new Uint8Array(s+n);e.cipher(o.AES_asm.ENC.CTR,o.AES_asm.HEAP_DATA+a,s+15&-16),s&&u.set(t.subarray(a,a+s));for(var c=s;15&c;c++)t[a+c]=0;e.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA+a,c);var f=void 0!==i?i.length:0,d=(r-1<<4)+s;return t[0]=0,t[1]=0,t[2]=0,t[3]=f>>>29,t[4]=f>>>21,t[5]=f>>>13&255,t[6]=f>>>5&255,t[7]=f<<3&255,t[8]=t[9]=t[10]=0,t[11]=d>>>29,t[12]=d>>>21&255,t[13]=d>>>13&255,t[14]=d>>>5&255,t[15]=d<<3&255,e.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA,16),e.get_iv(o.AES_asm.HEAP_DATA),e.set_counter(0,0,0,this.gamma0),e.cipher(o.AES_asm.ENC.CTR,o.AES_asm.HEAP_DATA,16),u.set(t.subarray(0,n),s),this.counter=1,this.pos=0,this.len=0,u},t.prototype.AES_GCM_Decrypt_process=function(e){var t=0,r=e.length||0,n=this.asm,i=this.heap,s=this.counter,u=this.tagSize,f=this.pos,d=this.len,l=0,h=d+r>u?d+r-u&-16:0,p=d+r-h,y=0;if((s-1<<4)+d+r>c)throw new RangeError("counter overflow");for(var b=new Uint8Array(h);r>p;)d+=y=(0,a._heap_write)(i,f+d,e,t,r-p),t+=y,r-=y,y=n.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA+f,y),(y=n.cipher(o.AES_asm.DEC.CTR,o.AES_asm.HEAP_DATA+f,y))&&b.set(i.subarray(f,f+y),l),s+=y>>>4,l+=y,f=0,d=0;return r>0&&(d+=(0,a._heap_write)(i,0,e,t,r)),this.counter=s,this.pos=f,this.len=d,b},t.prototype.AES_GCM_Decrypt_finish=function(){var e=this.asm,t=this.heap,r=this.tagSize,n=this.adata,a=this.counter,s=this.pos,u=this.len,c=u-r;if(u<r)throw new i.IllegalStateError("authentication tag not found");for(var f=new Uint8Array(c),d=new Uint8Array(t.subarray(s+c,s+u)),l=c;15&l;l++)t[s+l]=0;e.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA+s,l),e.cipher(o.AES_asm.DEC.CTR,o.AES_asm.HEAP_DATA+s,l),c&&f.set(t.subarray(s,s+c));var h=void 0!==n?n.length:0,p=(a-1<<4)+u-r;t[0]=0,t[1]=0,t[2]=0,t[3]=h>>>29,t[4]=h>>>21,t[5]=h>>>13&255,t[6]=h>>>5&255,t[7]=h<<3&255,t[8]=t[9]=t[10]=0,t[11]=p>>>29,t[12]=p>>>21&255,t[13]=p>>>13&255,t[14]=p>>>5&255,t[15]=p<<3&255,e.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA,16),e.get_iv(o.AES_asm.HEAP_DATA),e.set_counter(0,0,0,this.gamma0),e.cipher(o.AES_asm.ENC.CTR,o.AES_asm.HEAP_DATA,16);for(var y=0,b=0;b<r;++b)y|=d[b]^t[b];if(y)throw new i.SecurityError("data integrity check failed");return this.counter=1,this.pos=0,this.len=0,f},t.prototype.AES_GCM_decrypt=function(e){var t=this.AES_GCM_Decrypt_process(e),r=this.AES_GCM_Decrypt_finish(),n=new Uint8Array(t.length+r.length);return t.length&&n.set(t),r.length&&n.set(r,t.length),n},t.prototype.AES_GCM_encrypt=function(e){var t=this.AES_GCM_Encrypt_process(e),r=this.AES_GCM_Encrypt_finish(),n=new Uint8Array(t.length+r.length);return t.length&&n.set(t),r.length&&n.set(r,t.length),n},t.prototype._gcm_mac_process=function(e){for(var t=this.heap,r=this.asm,n=0,i=e.length||0,s=0;i>0;){for(n+=s=(0,a._heap_write)(t,0,e,n,i),i-=s;15&s;)t[s++]=0;r.mac(o.AES_asm.MAC.GCM,o.AES_asm.HEAP_DATA,s)}},t}(s.AES);r.AES_GCM=f},{"../other/errors":15,"../other/utils":16,"./aes":4,"./aes.asm":3}],10:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.Hash=void 0;var n=e("../other/utils"),i=e("../other/errors"),a=function(){function e(){this.pos=0,this.len=0,this.acquire_asm()}return e.prototype.acquire_asm=function(){void 0===this.heap&&void 0===this.asm&&(this.heap=this.constructor.heap_pool.pop()||(0,n._heap_init)(),this.asm=this.constructor.asm_pool.pop()||this.constructor.asm_function({Uint8Array:Uint8Array},null,this.heap.buffer),this.reset())},e.prototype.release_asm=function(){this.constructor.heap_pool.push(this.heap),this.constructor.asm_pool.push(this.asm),this.heap=void 0,this.asm=void 0},e.prototype.reset=function(){return this.acquire_asm(),this.result=null,this.pos=0,this.len=0,this.asm.reset(),this},e.prototype.process=function(e){if(null!==this.result)throw new i.IllegalStateError("state must be reset before processing new data");this.acquire_asm();for(var t=this.asm,r=this.heap,a=this.pos,s=this.len,o=0,u=e.length,c=0;u>0;)s+=c=(0,n._heap_write)(r,a+s,e,o,u),o+=c,u-=c,a+=c=t.process(a,s),(s-=c)||(a=0);return this.pos=a,this.len=s,this},e.prototype.finish=function(){if(null!==this.result)throw new i.IllegalStateError("state must be reset before processing new data");return this.acquire_asm(),this.asm.finish(this.pos,this.len,0),this.result=new Uint8Array(this.HASH_SIZE),this.result.set(this.heap.subarray(0,this.HASH_SIZE)),this.pos=0,this.len=0,this.release_asm(),this},e}();r.Hash=a},{"../other/errors":15,"../other/utils":16}],11:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.sha1_asm=function(e,t,r){"use asm";var n=0,i=0,a=0,s=0,o=0,u=0,c=0,f=0,d=0,l=0,h=0,p=0,y=0,b=0,m=0,g=0,w=0,_=new e.Uint8Array(r);function v(e,t,r,u,c,f,d,l,h,p,y,b,m,g,w,_){e=e|0;t=t|0;r=r|0;u=u|0;c=c|0;f=f|0;d=d|0;l=l|0;h=h|0;p=p|0;y=y|0;b=b|0;m=m|0;g=g|0;w=w|0;_=_|0;var v=0,k=0,A=0,S=0,E=0,P=0,x=0,M=0,C=0,j=0,R=0,B=0,K=0,I=0,U=0,T=0,z=0,O=0,D=0,N=0,q=0,F=0,L=0,W=0,H=0,Z=0,G=0,V=0,Y=0,X=0,$=0,J=0,Q=0,ee=0,te=0,re=0,ne=0,ie=0,ae=0,se=0,oe=0,ue=0,ce=0,fe=0,de=0,le=0,he=0,pe=0,ye=0,be=0,me=0,ge=0,we=0,_e=0,ve=0,ke=0,Ae=0,Se=0,Ee=0,Pe=0,xe=0,Me=0,Ce=0,je=0,Re=0,Be=0,Ke=0,Ie=0,Ue=0,Te=0,ze=0;v=n;k=i;A=a;S=s;E=o;x=e+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=t+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=r+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=u+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=c+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=f+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=d+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=l+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=h+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=p+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=y+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=b+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=m+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=g+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=w+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;x=_+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=g^h^r^e;M=P<<1|P>>>31;x=M+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=w^p^u^t;C=P<<1|P>>>31;x=C+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=_^y^c^r;j=P<<1|P>>>31;x=j+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=M^b^f^u;R=P<<1|P>>>31;x=R+(v<<5|v>>>27)+E+(k&A|~k&S)+0x5a827999|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=C^m^d^c;B=P<<1|P>>>31;x=B+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=j^g^l^f;K=P<<1|P>>>31;x=K+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=R^w^h^d;I=P<<1|P>>>31;x=I+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=B^_^p^l;U=P<<1|P>>>31;x=U+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=K^M^y^h;T=P<<1|P>>>31;x=T+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=I^C^b^p;z=P<<1|P>>>31;x=z+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=U^j^m^y;O=P<<1|P>>>31;x=O+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=T^R^g^b;D=P<<1|P>>>31;x=D+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=z^B^w^m;N=P<<1|P>>>31;x=N+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=O^K^_^g;q=P<<1|P>>>31;x=q+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=D^I^M^w;F=P<<1|P>>>31;x=F+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=N^U^C^_;L=P<<1|P>>>31;x=L+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=q^T^j^M;W=P<<1|P>>>31;x=W+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=F^z^R^C;H=P<<1|P>>>31;x=H+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=L^O^B^j;Z=P<<1|P>>>31;x=Z+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=W^D^K^R;G=P<<1|P>>>31;x=G+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=H^N^I^B;V=P<<1|P>>>31;x=V+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Z^q^U^K;Y=P<<1|P>>>31;x=Y+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=G^F^T^I;X=P<<1|P>>>31;x=X+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=V^L^z^U;$=P<<1|P>>>31;x=$+(v<<5|v>>>27)+E+(k^A^S)+0x6ed9eba1|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Y^W^O^T;J=P<<1|P>>>31;x=J+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=X^H^D^z;Q=P<<1|P>>>31;x=Q+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=$^Z^N^O;ee=P<<1|P>>>31;x=ee+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=J^G^q^D;te=P<<1|P>>>31;x=te+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Q^V^F^N;re=P<<1|P>>>31;x=re+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ee^Y^L^q;ne=P<<1|P>>>31;x=ne+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=te^X^W^F;ie=P<<1|P>>>31;x=ie+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=re^$^H^L;ae=P<<1|P>>>31;x=ae+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ne^J^Z^W;se=P<<1|P>>>31;x=se+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ie^Q^G^H;oe=P<<1|P>>>31;x=oe+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ae^ee^V^Z;ue=P<<1|P>>>31;x=ue+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=se^te^Y^G;ce=P<<1|P>>>31;x=ce+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=oe^re^X^V;fe=P<<1|P>>>31;x=fe+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ue^ne^$^Y;de=P<<1|P>>>31;x=de+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ce^ie^J^X;le=P<<1|P>>>31;x=le+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=fe^ae^Q^$;he=P<<1|P>>>31;x=he+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=de^se^ee^J;pe=P<<1|P>>>31;x=pe+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=le^oe^te^Q;ye=P<<1|P>>>31;x=ye+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=he^ue^re^ee;be=P<<1|P>>>31;x=be+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=pe^ce^ne^te;me=P<<1|P>>>31;x=me+(v<<5|v>>>27)+E+(k&A|k&S|A&S)-0x70e44324|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ye^fe^ie^re;ge=P<<1|P>>>31;x=ge+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=be^de^ae^ne;we=P<<1|P>>>31;x=we+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=me^le^se^ie;_e=P<<1|P>>>31;x=_e+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ge^he^oe^ae;ve=P<<1|P>>>31;x=ve+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=we^pe^ue^se;ke=P<<1|P>>>31;x=ke+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=_e^ye^ce^oe;Ae=P<<1|P>>>31;x=Ae+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ve^be^fe^ue;Se=P<<1|P>>>31;x=Se+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=ke^me^de^ce;Ee=P<<1|P>>>31;x=Ee+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Ae^ge^le^fe;Pe=P<<1|P>>>31;x=Pe+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Se^we^he^de;xe=P<<1|P>>>31;x=xe+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Ee^_e^pe^le;Me=P<<1|P>>>31;x=Me+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Pe^ve^ye^he;Ce=P<<1|P>>>31;x=Ce+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=xe^ke^be^pe;je=P<<1|P>>>31;x=je+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Me^Ae^me^ye;Re=P<<1|P>>>31;x=Re+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Ce^Se^ge^be;Be=P<<1|P>>>31;x=Be+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=je^Ee^we^me;Ke=P<<1|P>>>31;x=Ke+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Re^Pe^_e^ge;Ie=P<<1|P>>>31;x=Ie+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Be^xe^ve^we;Ue=P<<1|P>>>31;x=Ue+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Ke^Me^ke^_e;Te=P<<1|P>>>31;x=Te+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;P=Ie^Ce^Ae^ve;ze=P<<1|P>>>31;x=ze+(v<<5|v>>>27)+E+(k^A^S)-0x359d3e2a|0;E=S;S=A;A=k<<30|k>>>2;k=v;v=x;n=n+v|0;i=i+k|0;a=a+A|0;s=s+S|0;o=o+E|0}function k(e){e=e|0;v(_[e|0]<<24|_[e|1]<<16|_[e|2]<<8|_[e|3],_[e|4]<<24|_[e|5]<<16|_[e|6]<<8|_[e|7],_[e|8]<<24|_[e|9]<<16|_[e|10]<<8|_[e|11],_[e|12]<<24|_[e|13]<<16|_[e|14]<<8|_[e|15],_[e|16]<<24|_[e|17]<<16|_[e|18]<<8|_[e|19],_[e|20]<<24|_[e|21]<<16|_[e|22]<<8|_[e|23],_[e|24]<<24|_[e|25]<<16|_[e|26]<<8|_[e|27],_[e|28]<<24|_[e|29]<<16|_[e|30]<<8|_[e|31],_[e|32]<<24|_[e|33]<<16|_[e|34]<<8|_[e|35],_[e|36]<<24|_[e|37]<<16|_[e|38]<<8|_[e|39],_[e|40]<<24|_[e|41]<<16|_[e|42]<<8|_[e|43],_[e|44]<<24|_[e|45]<<16|_[e|46]<<8|_[e|47],_[e|48]<<24|_[e|49]<<16|_[e|50]<<8|_[e|51],_[e|52]<<24|_[e|53]<<16|_[e|54]<<8|_[e|55],_[e|56]<<24|_[e|57]<<16|_[e|58]<<8|_[e|59],_[e|60]<<24|_[e|61]<<16|_[e|62]<<8|_[e|63])}function A(e){e=e|0;_[e|0]=n>>>24;_[e|1]=n>>>16&255;_[e|2]=n>>>8&255;_[e|3]=n&255;_[e|4]=i>>>24;_[e|5]=i>>>16&255;_[e|6]=i>>>8&255;_[e|7]=i&255;_[e|8]=a>>>24;_[e|9]=a>>>16&255;_[e|10]=a>>>8&255;_[e|11]=a&255;_[e|12]=s>>>24;_[e|13]=s>>>16&255;_[e|14]=s>>>8&255;_[e|15]=s&255;_[e|16]=o>>>24;_[e|17]=o>>>16&255;_[e|18]=o>>>8&255;_[e|19]=o&255}function S(){n=0x67452301;i=0xefcdab89;a=0x98badcfe;s=0x10325476;o=0xc3d2e1f0;u=c=0}function E(e,t,r,f,d,l,h){e=e|0;t=t|0;r=r|0;f=f|0;d=d|0;l=l|0;h=h|0;n=e;i=t;a=r;s=f;o=d;u=l;c=h}function P(e,t){e=e|0;t=t|0;var r=0;if(e&63)return-1;while((t|0)>=64){k(e);e=e+64|0;t=t-64|0;r=r+64|0}u=u+r|0;if(u>>>0<r>>>0)c=c+1|0;return r|0}function x(e,t,r){e=e|0;t=t|0;r=r|0;var n=0,i=0;if(e&63)return-1;if(~r)if(r&31)return-1;if((t|0)>=64){n=P(e,t)|0;if((n|0)==-1)return-1;e=e+n|0;t=t-n|0}n=n+t|0;u=u+t|0;if(u>>>0<t>>>0)c=c+1|0;_[e|t]=0x80;if((t|0)>=56){for(i=t+1|0;(i|0)<64;i=i+1|0)_[e|i]=0x00;k(e);t=0;_[e|0]=0}for(i=t+1|0;(i|0)<59;i=i+1|0)_[e|i]=0;_[e|56]=c>>>21&255;_[e|57]=c>>>13&255;_[e|58]=c>>>5&255;_[e|59]=c<<3&255|u>>>29;_[e|60]=u>>>21&255;_[e|61]=u>>>13&255;_[e|62]=u>>>5&255;_[e|63]=u<<3&255;k(e);if(~r)A(r);return n|0}function M(){n=f;i=d;a=l;s=h;o=p;u=64;c=0}function C(){n=y;i=b;a=m;s=g;o=w;u=64;c=0}function j(e,t,r,_,k,A,E,P,x,M,C,j,R,B,K,I){e=e|0;t=t|0;r=r|0;_=_|0;k=k|0;A=A|0;E=E|0;P=P|0;x=x|0;M=M|0;C=C|0;j=j|0;R=R|0;B=B|0;K=K|0;I=I|0;S();v(e^0x5c5c5c5c,t^0x5c5c5c5c,r^0x5c5c5c5c,_^0x5c5c5c5c,k^0x5c5c5c5c,A^0x5c5c5c5c,E^0x5c5c5c5c,P^0x5c5c5c5c,x^0x5c5c5c5c,M^0x5c5c5c5c,C^0x5c5c5c5c,j^0x5c5c5c5c,R^0x5c5c5c5c,B^0x5c5c5c5c,K^0x5c5c5c5c,I^0x5c5c5c5c);y=n;b=i;m=a;g=s;w=o;S();v(e^0x36363636,t^0x36363636,r^0x36363636,_^0x36363636,k^0x36363636,A^0x36363636,E^0x36363636,P^0x36363636,x^0x36363636,M^0x36363636,C^0x36363636,j^0x36363636,R^0x36363636,B^0x36363636,K^0x36363636,I^0x36363636);f=n;d=i;l=a;h=s;p=o;u=64;c=0}function R(e,t,r){e=e|0;t=t|0;r=r|0;var u=0,c=0,f=0,d=0,l=0,h=0;if(e&63)return-1;if(~r)if(r&31)return-1;h=x(e,t,-1)|0;u=n,c=i,f=a,d=s,l=o;C();v(u,c,f,d,l,0x80000000,0,0,0,0,0,0,0,0,0,672);if(~r)A(r);return h|0}function B(e,t,r,u,c){e=e|0;t=t|0;r=r|0;u=u|0;c=c|0;var f=0,d=0,l=0,h=0,p=0,y=0,b=0,m=0,g=0,w=0;if(e&63)return-1;if(~c)if(c&31)return-1;_[e+t|0]=r>>>24;_[e+t+1|0]=r>>>16&255;_[e+t+2|0]=r>>>8&255;_[e+t+3|0]=r&255;R(e,t+4|0,-1)|0;f=y=n,d=b=i,l=m=a,h=g=s,p=w=o;u=u-1|0;while((u|0)>0){M();v(y,b,m,g,w,0x80000000,0,0,0,0,0,0,0,0,0,672);y=n,b=i,m=a,g=s,w=o;C();v(y,b,m,g,w,0x80000000,0,0,0,0,0,0,0,0,0,672);y=n,b=i,m=a,g=s,w=o;f=f^n;d=d^i;l=l^a;h=h^s;p=p^o;u=u-1|0}n=f;i=d;a=l;s=h;o=p;if(~c)A(c);return 0}return{reset:S,init:E,process:P,finish:x,hmac_reset:M,hmac_init:j,hmac_finish:R,pbkdf2_generate_block:B}}},{}],12:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.Sha1=r._sha1_hash_size=r._sha1_block_size=void 0;var n,i=e("./sha1.asm"),a=e("../hash"),s=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=r._sha1_block_size=64,u=r._sha1_hash_size=20,c=function(e){function t(){var t=null!==e&&e.apply(this,arguments)||this;return t.NAME="sha1",t.BLOCK_SIZE=o,t.HASH_SIZE=u,t}return s(t,e),t.bytes=function(e){return(new t).process(e).finish().result},t.NAME="sha1",t.heap_pool=[],t.asm_pool=[],t.asm_function=i.sha1_asm,t}(a.Hash);r.Sha1=c},{"../hash":10,"./sha1.asm":11}],13:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.sha256_asm=function(e,t,r){"use asm";var n=0,i=0,a=0,s=0,o=0,u=0,c=0,f=0,d=0,l=0,h=0,p=0,y=0,b=0,m=0,g=0,w=0,_=0,v=0,k=0,A=0,S=0,E=0,P=0,x=0,M=0,C=new e.Uint8Array(r);function j(e,t,r,d,l,h,p,y,b,m,g,w,_,v,k,A){e=e|0;t=t|0;r=r|0;d=d|0;l=l|0;h=h|0;p=p|0;y=y|0;b=b|0;m=m|0;g=g|0;w=w|0;_=_|0;v=v|0;k=k|0;A=A|0;var S=0,E=0,P=0,x=0,M=0,C=0,j=0,R=0;S=n;E=i;P=a;x=s;M=o;C=u;j=c;R=f;R=e+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0x428a2f98|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;j=t+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0x71374491|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;C=r+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0xb5c0fbcf|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;M=d+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0xe9b5dba5|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;x=l+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0x3956c25b|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;P=h+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0x59f111f1|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;E=p+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0x923f82a4|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;S=y+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0xab1c5ed5|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;R=b+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0xd807aa98|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;j=m+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0x12835b01|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;C=g+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0x243185be|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;M=w+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0x550c7dc3|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;x=_+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0x72be5d74|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;P=v+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0x80deb1fe|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;E=k+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0x9bdc06a7|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;S=A+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0xc19bf174|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;e=(t>>>7^t>>>18^t>>>3^t<<25^t<<14)+(k>>>17^k>>>19^k>>>10^k<<15^k<<13)+e+m|0;R=e+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0xe49b69c1|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;t=(r>>>7^r>>>18^r>>>3^r<<25^r<<14)+(A>>>17^A>>>19^A>>>10^A<<15^A<<13)+t+g|0;j=t+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0xefbe4786|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;r=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+r+w|0;C=r+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0x0fc19dc6|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;d=(l>>>7^l>>>18^l>>>3^l<<25^l<<14)+(t>>>17^t>>>19^t>>>10^t<<15^t<<13)+d+_|0;M=d+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0x240ca1cc|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;l=(h>>>7^h>>>18^h>>>3^h<<25^h<<14)+(r>>>17^r>>>19^r>>>10^r<<15^r<<13)+l+v|0;x=l+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0x2de92c6f|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;h=(p>>>7^p>>>18^p>>>3^p<<25^p<<14)+(d>>>17^d>>>19^d>>>10^d<<15^d<<13)+h+k|0;P=h+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0x4a7484aa|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;p=(y>>>7^y>>>18^y>>>3^y<<25^y<<14)+(l>>>17^l>>>19^l>>>10^l<<15^l<<13)+p+A|0;E=p+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0x5cb0a9dc|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;y=(b>>>7^b>>>18^b>>>3^b<<25^b<<14)+(h>>>17^h>>>19^h>>>10^h<<15^h<<13)+y+e|0;S=y+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0x76f988da|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;b=(m>>>7^m>>>18^m>>>3^m<<25^m<<14)+(p>>>17^p>>>19^p>>>10^p<<15^p<<13)+b+t|0;R=b+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0x983e5152|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;m=(g>>>7^g>>>18^g>>>3^g<<25^g<<14)+(y>>>17^y>>>19^y>>>10^y<<15^y<<13)+m+r|0;j=m+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0xa831c66d|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;g=(w>>>7^w>>>18^w>>>3^w<<25^w<<14)+(b>>>17^b>>>19^b>>>10^b<<15^b<<13)+g+d|0;C=g+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0xb00327c8|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;w=(_>>>7^_>>>18^_>>>3^_<<25^_<<14)+(m>>>17^m>>>19^m>>>10^m<<15^m<<13)+w+l|0;M=w+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0xbf597fc7|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;_=(v>>>7^v>>>18^v>>>3^v<<25^v<<14)+(g>>>17^g>>>19^g>>>10^g<<15^g<<13)+_+h|0;x=_+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0xc6e00bf3|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;v=(k>>>7^k>>>18^k>>>3^k<<25^k<<14)+(w>>>17^w>>>19^w>>>10^w<<15^w<<13)+v+p|0;P=v+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0xd5a79147|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;k=(A>>>7^A>>>18^A>>>3^A<<25^A<<14)+(_>>>17^_>>>19^_>>>10^_<<15^_<<13)+k+y|0;E=k+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0x06ca6351|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;A=(e>>>7^e>>>18^e>>>3^e<<25^e<<14)+(v>>>17^v>>>19^v>>>10^v<<15^v<<13)+A+b|0;S=A+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0x14292967|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;e=(t>>>7^t>>>18^t>>>3^t<<25^t<<14)+(k>>>17^k>>>19^k>>>10^k<<15^k<<13)+e+m|0;R=e+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0x27b70a85|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;t=(r>>>7^r>>>18^r>>>3^r<<25^r<<14)+(A>>>17^A>>>19^A>>>10^A<<15^A<<13)+t+g|0;j=t+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0x2e1b2138|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;r=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+r+w|0;C=r+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0x4d2c6dfc|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;d=(l>>>7^l>>>18^l>>>3^l<<25^l<<14)+(t>>>17^t>>>19^t>>>10^t<<15^t<<13)+d+_|0;M=d+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0x53380d13|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;l=(h>>>7^h>>>18^h>>>3^h<<25^h<<14)+(r>>>17^r>>>19^r>>>10^r<<15^r<<13)+l+v|0;x=l+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0x650a7354|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;h=(p>>>7^p>>>18^p>>>3^p<<25^p<<14)+(d>>>17^d>>>19^d>>>10^d<<15^d<<13)+h+k|0;P=h+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0x766a0abb|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;p=(y>>>7^y>>>18^y>>>3^y<<25^y<<14)+(l>>>17^l>>>19^l>>>10^l<<15^l<<13)+p+A|0;E=p+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0x81c2c92e|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;y=(b>>>7^b>>>18^b>>>3^b<<25^b<<14)+(h>>>17^h>>>19^h>>>10^h<<15^h<<13)+y+e|0;S=y+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0x92722c85|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;b=(m>>>7^m>>>18^m>>>3^m<<25^m<<14)+(p>>>17^p>>>19^p>>>10^p<<15^p<<13)+b+t|0;R=b+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0xa2bfe8a1|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;m=(g>>>7^g>>>18^g>>>3^g<<25^g<<14)+(y>>>17^y>>>19^y>>>10^y<<15^y<<13)+m+r|0;j=m+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0xa81a664b|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;g=(w>>>7^w>>>18^w>>>3^w<<25^w<<14)+(b>>>17^b>>>19^b>>>10^b<<15^b<<13)+g+d|0;C=g+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0xc24b8b70|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;w=(_>>>7^_>>>18^_>>>3^_<<25^_<<14)+(m>>>17^m>>>19^m>>>10^m<<15^m<<13)+w+l|0;M=w+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0xc76c51a3|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;_=(v>>>7^v>>>18^v>>>3^v<<25^v<<14)+(g>>>17^g>>>19^g>>>10^g<<15^g<<13)+_+h|0;x=_+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0xd192e819|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;v=(k>>>7^k>>>18^k>>>3^k<<25^k<<14)+(w>>>17^w>>>19^w>>>10^w<<15^w<<13)+v+p|0;P=v+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0xd6990624|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;k=(A>>>7^A>>>18^A>>>3^A<<25^A<<14)+(_>>>17^_>>>19^_>>>10^_<<15^_<<13)+k+y|0;E=k+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0xf40e3585|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;A=(e>>>7^e>>>18^e>>>3^e<<25^e<<14)+(v>>>17^v>>>19^v>>>10^v<<15^v<<13)+A+b|0;S=A+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0x106aa070|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;e=(t>>>7^t>>>18^t>>>3^t<<25^t<<14)+(k>>>17^k>>>19^k>>>10^k<<15^k<<13)+e+m|0;R=e+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0x19a4c116|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;t=(r>>>7^r>>>18^r>>>3^r<<25^r<<14)+(A>>>17^A>>>19^A>>>10^A<<15^A<<13)+t+g|0;j=t+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0x1e376c08|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;r=(d>>>7^d>>>18^d>>>3^d<<25^d<<14)+(e>>>17^e>>>19^e>>>10^e<<15^e<<13)+r+w|0;C=r+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0x2748774c|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;d=(l>>>7^l>>>18^l>>>3^l<<25^l<<14)+(t>>>17^t>>>19^t>>>10^t<<15^t<<13)+d+_|0;M=d+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0x34b0bcb5|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;l=(h>>>7^h>>>18^h>>>3^h<<25^h<<14)+(r>>>17^r>>>19^r>>>10^r<<15^r<<13)+l+v|0;x=l+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0x391c0cb3|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;h=(p>>>7^p>>>18^p>>>3^p<<25^p<<14)+(d>>>17^d>>>19^d>>>10^d<<15^d<<13)+h+k|0;P=h+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0x4ed8aa4a|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;p=(y>>>7^y>>>18^y>>>3^y<<25^y<<14)+(l>>>17^l>>>19^l>>>10^l<<15^l<<13)+p+A|0;E=p+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0x5b9cca4f|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;y=(b>>>7^b>>>18^b>>>3^b<<25^b<<14)+(h>>>17^h>>>19^h>>>10^h<<15^h<<13)+y+e|0;S=y+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0x682e6ff3|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;b=(m>>>7^m>>>18^m>>>3^m<<25^m<<14)+(p>>>17^p>>>19^p>>>10^p<<15^p<<13)+b+t|0;R=b+R+(M>>>6^M>>>11^M>>>25^M<<26^M<<21^M<<7)+(j^M&(C^j))+0x748f82ee|0;x=x+R|0;R=R+(S&E^P&(S^E))+(S>>>2^S>>>13^S>>>22^S<<30^S<<19^S<<10)|0;m=(g>>>7^g>>>18^g>>>3^g<<25^g<<14)+(y>>>17^y>>>19^y>>>10^y<<15^y<<13)+m+r|0;j=m+j+(x>>>6^x>>>11^x>>>25^x<<26^x<<21^x<<7)+(C^x&(M^C))+0x78a5636f|0;P=P+j|0;j=j+(R&S^E&(R^S))+(R>>>2^R>>>13^R>>>22^R<<30^R<<19^R<<10)|0;g=(w>>>7^w>>>18^w>>>3^w<<25^w<<14)+(b>>>17^b>>>19^b>>>10^b<<15^b<<13)+g+d|0;C=g+C+(P>>>6^P>>>11^P>>>25^P<<26^P<<21^P<<7)+(M^P&(x^M))+0x84c87814|0;E=E+C|0;C=C+(j&R^S&(j^R))+(j>>>2^j>>>13^j>>>22^j<<30^j<<19^j<<10)|0;w=(_>>>7^_>>>18^_>>>3^_<<25^_<<14)+(m>>>17^m>>>19^m>>>10^m<<15^m<<13)+w+l|0;M=w+M+(E>>>6^E>>>11^E>>>25^E<<26^E<<21^E<<7)+(x^E&(P^x))+0x8cc70208|0;S=S+M|0;M=M+(C&j^R&(C^j))+(C>>>2^C>>>13^C>>>22^C<<30^C<<19^C<<10)|0;_=(v>>>7^v>>>18^v>>>3^v<<25^v<<14)+(g>>>17^g>>>19^g>>>10^g<<15^g<<13)+_+h|0;x=_+x+(S>>>6^S>>>11^S>>>25^S<<26^S<<21^S<<7)+(P^S&(E^P))+0x90befffa|0;R=R+x|0;x=x+(M&C^j&(M^C))+(M>>>2^M>>>13^M>>>22^M<<30^M<<19^M<<10)|0;v=(k>>>7^k>>>18^k>>>3^k<<25^k<<14)+(w>>>17^w>>>19^w>>>10^w<<15^w<<13)+v+p|0;P=v+P+(R>>>6^R>>>11^R>>>25^R<<26^R<<21^R<<7)+(E^R&(S^E))+0xa4506ceb|0;j=j+P|0;P=P+(x&M^C&(x^M))+(x>>>2^x>>>13^x>>>22^x<<30^x<<19^x<<10)|0;k=(A>>>7^A>>>18^A>>>3^A<<25^A<<14)+(_>>>17^_>>>19^_>>>10^_<<15^_<<13)+k+y|0;E=k+E+(j>>>6^j>>>11^j>>>25^j<<26^j<<21^j<<7)+(S^j&(R^S))+0xbef9a3f7|0;C=C+E|0;E=E+(P&x^M&(P^x))+(P>>>2^P>>>13^P>>>22^P<<30^P<<19^P<<10)|0;A=(e>>>7^e>>>18^e>>>3^e<<25^e<<14)+(v>>>17^v>>>19^v>>>10^v<<15^v<<13)+A+b|0;S=A+S+(C>>>6^C>>>11^C>>>25^C<<26^C<<21^C<<7)+(R^C&(j^R))+0xc67178f2|0;M=M+S|0;S=S+(E&P^x&(E^P))+(E>>>2^E>>>13^E>>>22^E<<30^E<<19^E<<10)|0;n=n+S|0;i=i+E|0;a=a+P|0;s=s+x|0;o=o+M|0;u=u+C|0;c=c+j|0;f=f+R|0}function R(e){e=e|0;j(C[e|0]<<24|C[e|1]<<16|C[e|2]<<8|C[e|3],C[e|4]<<24|C[e|5]<<16|C[e|6]<<8|C[e|7],C[e|8]<<24|C[e|9]<<16|C[e|10]<<8|C[e|11],C[e|12]<<24|C[e|13]<<16|C[e|14]<<8|C[e|15],C[e|16]<<24|C[e|17]<<16|C[e|18]<<8|C[e|19],C[e|20]<<24|C[e|21]<<16|C[e|22]<<8|C[e|23],C[e|24]<<24|C[e|25]<<16|C[e|26]<<8|C[e|27],C[e|28]<<24|C[e|29]<<16|C[e|30]<<8|C[e|31],C[e|32]<<24|C[e|33]<<16|C[e|34]<<8|C[e|35],C[e|36]<<24|C[e|37]<<16|C[e|38]<<8|C[e|39],C[e|40]<<24|C[e|41]<<16|C[e|42]<<8|C[e|43],C[e|44]<<24|C[e|45]<<16|C[e|46]<<8|C[e|47],C[e|48]<<24|C[e|49]<<16|C[e|50]<<8|C[e|51],C[e|52]<<24|C[e|53]<<16|C[e|54]<<8|C[e|55],C[e|56]<<24|C[e|57]<<16|C[e|58]<<8|C[e|59],C[e|60]<<24|C[e|61]<<16|C[e|62]<<8|C[e|63])}function B(e){e=e|0;C[e|0]=n>>>24;C[e|1]=n>>>16&255;C[e|2]=n>>>8&255;C[e|3]=n&255;C[e|4]=i>>>24;C[e|5]=i>>>16&255;C[e|6]=i>>>8&255;C[e|7]=i&255;C[e|8]=a>>>24;C[e|9]=a>>>16&255;C[e|10]=a>>>8&255;C[e|11]=a&255;C[e|12]=s>>>24;C[e|13]=s>>>16&255;C[e|14]=s>>>8&255;C[e|15]=s&255;C[e|16]=o>>>24;C[e|17]=o>>>16&255;C[e|18]=o>>>8&255;C[e|19]=o&255;C[e|20]=u>>>24;C[e|21]=u>>>16&255;C[e|22]=u>>>8&255;C[e|23]=u&255;C[e|24]=c>>>24;C[e|25]=c>>>16&255;C[e|26]=c>>>8&255;C[e|27]=c&255;C[e|28]=f>>>24;C[e|29]=f>>>16&255;C[e|30]=f>>>8&255;C[e|31]=f&255}function K(){n=0x6a09e667;i=0xbb67ae85;a=0x3c6ef372;s=0xa54ff53a;o=0x510e527f;u=0x9b05688c;c=0x1f83d9ab;f=0x5be0cd19;d=l=0}function I(e,t,r,h,p,y,b,m,g,w){e=e|0;t=t|0;r=r|0;h=h|0;p=p|0;y=y|0;b=b|0;m=m|0;g=g|0;w=w|0;n=e;i=t;a=r;s=h;o=p;u=y;c=b;f=m;d=g;l=w}function U(e,t){e=e|0;t=t|0;var r=0;if(e&63)return-1;while((t|0)>=64){R(e);e=e+64|0;t=t-64|0;r=r+64|0}d=d+r|0;if(d>>>0<r>>>0)l=l+1|0;return r|0}function T(e,t,r){e=e|0;t=t|0;r=r|0;var n=0,i=0;if(e&63)return-1;if(~r)if(r&31)return-1;if((t|0)>=64){n=U(e,t)|0;if((n|0)==-1)return-1;e=e+n|0;t=t-n|0}n=n+t|0;d=d+t|0;if(d>>>0<t>>>0)l=l+1|0;C[e|t]=0x80;if((t|0)>=56){for(i=t+1|0;(i|0)<64;i=i+1|0)C[e|i]=0x00;R(e);t=0;C[e|0]=0}for(i=t+1|0;(i|0)<59;i=i+1|0)C[e|i]=0;C[e|56]=l>>>21&255;C[e|57]=l>>>13&255;C[e|58]=l>>>5&255;C[e|59]=l<<3&255|d>>>29;C[e|60]=d>>>21&255;C[e|61]=d>>>13&255;C[e|62]=d>>>5&255;C[e|63]=d<<3&255;R(e);if(~r)B(r);return n|0}function z(){n=h;i=p;a=y;s=b;o=m;u=g;c=w;f=_;d=64;l=0}function O(){n=v;i=k;a=A;s=S;o=E;u=P;c=x;f=M;d=64;l=0}function D(e,t,r,C,R,B,I,U,T,z,O,D,N,q,F,L){e=e|0;t=t|0;r=r|0;C=C|0;R=R|0;B=B|0;I=I|0;U=U|0;T=T|0;z=z|0;O=O|0;D=D|0;N=N|0;q=q|0;F=F|0;L=L|0;K();j(e^0x5c5c5c5c,t^0x5c5c5c5c,r^0x5c5c5c5c,C^0x5c5c5c5c,R^0x5c5c5c5c,B^0x5c5c5c5c,I^0x5c5c5c5c,U^0x5c5c5c5c,T^0x5c5c5c5c,z^0x5c5c5c5c,O^0x5c5c5c5c,D^0x5c5c5c5c,N^0x5c5c5c5c,q^0x5c5c5c5c,F^0x5c5c5c5c,L^0x5c5c5c5c);v=n;k=i;A=a;S=s;E=o;P=u;x=c;M=f;K();j(e^0x36363636,t^0x36363636,r^0x36363636,C^0x36363636,R^0x36363636,B^0x36363636,I^0x36363636,U^0x36363636,T^0x36363636,z^0x36363636,O^0x36363636,D^0x36363636,N^0x36363636,q^0x36363636,F^0x36363636,L^0x36363636);h=n;p=i;y=a;b=s;m=o;g=u;w=c;_=f;d=64;l=0}function N(e,t,r){e=e|0;t=t|0;r=r|0;var d=0,l=0,h=0,p=0,y=0,b=0,m=0,g=0,w=0;if(e&63)return-1;if(~r)if(r&31)return-1;w=T(e,t,-1)|0;d=n,l=i,h=a,p=s,y=o,b=u,m=c,g=f;O();j(d,l,h,p,y,b,m,g,0x80000000,0,0,0,0,0,0,768);if(~r)B(r);return w|0}function q(e,t,r,d,l){e=e|0;t=t|0;r=r|0;d=d|0;l=l|0;var h=0,p=0,y=0,b=0,m=0,g=0,w=0,_=0,v=0,k=0,A=0,S=0,E=0,P=0,x=0,M=0;if(e&63)return-1;if(~l)if(l&31)return-1;C[e+t|0]=r>>>24;C[e+t+1|0]=r>>>16&255;C[e+t+2|0]=r>>>8&255;C[e+t+3|0]=r&255;N(e,t+4|0,-1)|0;h=v=n,p=k=i,y=A=a,b=S=s,m=E=o,g=P=u,w=x=c,_=M=f;d=d-1|0;while((d|0)>0){z();j(v,k,A,S,E,P,x,M,0x80000000,0,0,0,0,0,0,768);v=n,k=i,A=a,S=s,E=o,P=u,x=c,M=f;O();j(v,k,A,S,E,P,x,M,0x80000000,0,0,0,0,0,0,768);v=n,k=i,A=a,S=s,E=o,P=u,x=c,M=f;h=h^n;p=p^i;y=y^a;b=b^s;m=m^o;g=g^u;w=w^c;_=_^f;d=d-1|0}n=h;i=p;a=y;s=b;o=m;u=g;c=w;f=_;if(~l)B(l);return 0}return{reset:K,init:I,process:U,finish:T,hmac_reset:z,hmac_init:D,hmac_finish:N,pbkdf2_generate_block:q}}},{}],14:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.Sha256=r._sha256_hash_size=r._sha256_block_size=void 0;var n,i=e("./sha256.asm"),a=e("../hash"),s=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=r._sha256_block_size=64,u=r._sha256_hash_size=32,c=function(e){function t(){var t=null!==e&&e.apply(this,arguments)||this;return t.NAME="sha256",t.BLOCK_SIZE=o,t.HASH_SIZE=u,t}return s(t,e),t.bytes=function(e){return(new t).process(e).finish().result},t.NAME="sha256",t.heap_pool=[],t.asm_pool=[],t.asm_function=i.sha256_asm,t}(a.Hash);r.Sha256=c},{"../hash":10,"./sha256.asm":13}],15:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),a=function(e){function t(){for(var t=[],r=0;r<arguments.length;r++)t[r]=arguments[r];var n=e.apply(this,t)||this;return Object.create(Error.prototype,{name:{value:"IllegalStateError"}}),n}return i(t,e),t}(Error);r.IllegalStateError=a;var s=function(e){function t(){for(var t=[],r=0;r<arguments.length;r++)t[r]=arguments[r];var n=e.apply(this,t)||this;return Object.create(Error.prototype,{name:{value:"IllegalArgumentError"}}),n}return i(t,e),t}(Error);r.IllegalArgumentError=s;var o=function(e){function t(){for(var t=[],r=0;r<arguments.length;r++)t[r]=arguments[r];var n=e.apply(this,t)||this;return Object.create(Error.prototype,{name:{value:"SecurityError"}}),n}return i(t,e),t}(Error);r.SecurityError=o},{}],16:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.string_to_bytes=a,r.hex_to_bytes=function(e){var t=e.length;1&t&&(e="0"+e,t++);for(var r=new Uint8Array(t>>1),n=0;n<t;n+=2)r[n>>1]=parseInt(e.substr(n,2),16);return r},r.base64_to_bytes=function(e){return a(n(e))},r.bytes_to_string=s,r.bytes_to_hex=function(e){for(var t="",r=0;r<e.length;r++){var n=(255&e[r]).toString(16);n.length<2&&(t+="0"),t+=n}return t},r.bytes_to_base64=function(e){return i(s(e))},r.pow2_ceil=function(e){return e-=1,e|=e>>>1,e|=e>>>2,e|=e>>>4,e|=e>>>8,e|=e>>>16,e+=1},r.is_number=function(e){return"number"==typeof e},r.is_string=function(e){return"string"==typeof e},r.is_buffer=function(e){return e instanceof ArrayBuffer},r.is_bytes=function(e){return e instanceof Uint8Array},r.is_typed_array=function(e){return e instanceof Int8Array||e instanceof Uint8Array||e instanceof Int16Array||e instanceof Uint16Array||e instanceof Int32Array||e instanceof Uint32Array||e instanceof Float32Array||e instanceof Float64Array},r._heap_init=function(e,t){var r=e?e.byteLength:t||65536;if(4095&r||r<=0)throw new Error("heap size must be a positive integer and a multiple of 4096");return e=e||new Uint8Array(new ArrayBuffer(r))},r._heap_write=function(e,t,r,n,i){var a=e.length-t,s=a<i?a:i;return e.set(r.subarray(n,n+s),t),s},r.joinBytes=function(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];for(var r=e.reduce(function(e,t){return e+t.length},0),n=new Uint8Array(r),i=0,a=0;a<e.length;a++)n.set(e[a],i),i+=e[a].length;return n};var n="undefined"==typeof atob?function(t){return e("buffer").Buffer.from(t,"base64").toString("binary")}:atob,i="undefined"==typeof btoa?function(t){return e("buffer").Buffer.from(t,"binary").toString("base64")}:btoa;function a(e,t){void 0===t&&(t=!1);for(var r=e.length,n=new Uint8Array(t?4*r:r),i=0,a=0;i<r;i++){var s=e.charCodeAt(i);if(t&&55296<=s&&s<=56319){if(++i>=r)throw new Error("Malformed string, low surrogate expected at position "+i);s=(55296^s)<<10|65536|56320^e.charCodeAt(i)}else if(!t&&s>>>8)throw new Error("Wide characters are not allowed.");!t||s<=127?n[a++]=s:s<=2047?(n[a++]=192|s>>6,n[a++]=128|63&s):s<=65535?(n[a++]=224|s>>12,n[a++]=128|s>>6&63,n[a++]=128|63&s):(n[a++]=240|s>>18,n[a++]=128|s>>12&63,n[a++]=128|s>>6&63,n[a++]=128|63&s)}return n.subarray(0,a)}function s(e,t){void 0===t&&(t=!1);for(var r=e.length,n=new Array(r),i=0,a=0;i<r;i++){var s=e[i];if(!t||s<128)n[a++]=s;else if(s>=192&&s<224&&i+1<r)n[a++]=(31&s)<<6|63&e[++i];else if(s>=224&&s<240&&i+2<r)n[a++]=(15&s)<<12|(63&e[++i])<<6|63&e[++i];else{if(!(s>=240&&s<248&&i+3<r))throw new Error("Malformed UTF8 character at byte offset "+i);var o=(7&s)<<18|(63&e[++i])<<12|(63&e[++i])<<6|63&e[++i];o<=65535?n[a++]=o:(o^=65536,n[a++]=55296|o>>10,n[a++]=56320|1023&o)}}var u="";for(i=0;i<a;i+=16384)u+=String.fromCharCode.apply(String,n.slice(i,i+16384<=a?i+16384:a));return u}},{buffer:"buffer"}],17:[function(e,t,r){!function(t,r){"use strict";function n(e,t){if(!e)throw new Error(t||"Assertion failed")}function i(e,t){e.super_=t;var r=function(){};r.prototype=t.prototype,e.prototype=new r,e.prototype.constructor=e}function a(e,t,r){if(a.isBN(e))return e;this.negative=0,this.words=null,this.length=0,this.red=null,null!==e&&("le"!==t&&"be"!==t||(r=t,t=10),this._init(e||0,t||10,r||"be"))}var s;"object"==typeof t?t.exports=a:r.BN=a,a.BN=a,a.wordSize=26;try{s=e("buffer").Buffer}catch(S){}function o(e,t,r){for(var n=0,i=Math.min(e.length,r),a=t;a<i;a++){var s=e.charCodeAt(a)-48;n<<=4,n|=s>=49&&s<=54?s-49+10:s>=17&&s<=22?s-17+10:15&s}return n}function u(e,t,r,n){for(var i=0,a=Math.min(e.length,r),s=t;s<a;s++){var o=e.charCodeAt(s)-48;i*=n,i+=o>=49?o-49+10:o>=17?o-17+10:o}return i}a.isBN=function(e){return e instanceof a||null!==e&&"object"==typeof e&&e.constructor.wordSize===a.wordSize&&Array.isArray(e.words)},a.max=function(e,t){return e.cmp(t)>0?e:t},a.min=function(e,t){return e.cmp(t)<0?e:t},a.prototype._init=function(e,t,r){if("number"==typeof e)return this._initNumber(e,t,r);if("object"==typeof e)return this._initArray(e,t,r);"hex"===t&&(t=16),n(t===(0|t)&&t>=2&&t<=36);var i=0;"-"===(e=e.toString().replace(/\s+/g,""))[0]&&i++,16===t?this._parseHex(e,i):this._parseBase(e,t,i),"-"===e[0]&&(this.negative=1),this.strip(),"le"===r&&this._initArray(this.toArray(),t,r)},a.prototype._initNumber=function(e,t,r){e<0&&(this.negative=1,e=-e),e<67108864?(this.words=[67108863&e],this.length=1):e<4503599627370496?(this.words=[67108863&e,e/67108864&67108863],this.length=2):(n(e<9007199254740992),this.words=[67108863&e,e/67108864&67108863,1],this.length=3),"le"===r&&this._initArray(this.toArray(),t,r)},a.prototype._initArray=function(e,t,r){if(n("number"==typeof e.length),e.length<=0)return this.words=[0],this.length=1,this;this.length=Math.ceil(e.length/3),this.words=new Array(this.length);for(var i=0;i<this.length;i++)this.words[i]=0;var a,s,o=0;if("be"===r)for(i=e.length-1,a=0;i>=0;i-=3)s=e[i]|e[i-1]<<8|e[i-2]<<16,this.words[a]|=s<<o&67108863,this.words[a+1]=s>>>26-o&67108863,(o+=24)>=26&&(o-=26,a++);else if("le"===r)for(i=0,a=0;i<e.length;i+=3)s=e[i]|e[i+1]<<8|e[i+2]<<16,this.words[a]|=s<<o&67108863,this.words[a+1]=s>>>26-o&67108863,(o+=24)>=26&&(o-=26,a++);return this.strip()},a.prototype._parseHex=function(e,t){this.length=Math.ceil((e.length-t)/6),this.words=new Array(this.length);for(var r=0;r<this.length;r++)this.words[r]=0;var n,i,a=0;for(r=e.length-6,n=0;r>=t;r-=6)i=o(e,r,r+6),this.words[n]|=i<<a&67108863,this.words[n+1]|=i>>>26-a&4194303,(a+=24)>=26&&(a-=26,n++);r+6!==t&&(i=o(e,t,r+6),this.words[n]|=i<<a&67108863,this.words[n+1]|=i>>>26-a&4194303),this.strip()},a.prototype._parseBase=function(e,t,r){this.words=[0],this.length=1;for(var n=0,i=1;i<=67108863;i*=t)n++;n--,i=i/t|0;for(var a=e.length-r,s=a%n,o=Math.min(a,a-s)+r,c=0,f=r;f<o;f+=n)c=u(e,f,f+n,t),this.imuln(i),this.words[0]+c<67108864?this.words[0]+=c:this._iaddn(c);if(0!==s){var d=1;for(c=u(e,f,e.length,t),f=0;f<s;f++)d*=t;this.imuln(d),this.words[0]+c<67108864?this.words[0]+=c:this._iaddn(c)}},a.prototype.copy=function(e){e.words=new Array(this.length);for(var t=0;t<this.length;t++)e.words[t]=this.words[t];e.length=this.length,e.negative=this.negative,e.red=this.red},a.prototype.clone=function(){var e=new a(null);return this.copy(e),e},a.prototype._expand=function(e){for(;this.length<e;)this.words[this.length++]=0;return this},a.prototype.strip=function(){for(;this.length>1&&0===this.words[this.length-1];)this.length--;return this._normSign()},a.prototype._normSign=function(){return 1===this.length&&0===this.words[0]&&(this.negative=0),this},a.prototype.inspect=function(){return(this.red?"<BN-R: ":"<BN: ")+this.toString(16)+">"};var c=["","0","00","000","0000","00000","000000","0000000","00000000","000000000","0000000000","00000000000","000000000000","0000000000000","00000000000000","000000000000000","0000000000000000","00000000000000000","000000000000000000","0000000000000000000","00000000000000000000","000000000000000000000","0000000000000000000000","00000000000000000000000","000000000000000000000000","0000000000000000000000000"],f=[0,0,25,16,12,11,10,9,8,8,7,7,7,7,6,6,6,6,6,6,6,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5],d=[0,0,33554432,43046721,16777216,48828125,60466176,40353607,16777216,43046721,1e7,19487171,35831808,62748517,7529536,11390625,16777216,24137569,34012224,47045881,64e6,4084101,5153632,6436343,7962624,9765625,11881376,14348907,17210368,20511149,243e5,28629151,33554432,39135393,45435424,52521875,60466176];function l(e,t,r){r.negative=t.negative^e.negative;var n=e.length+t.length|0;r.length=n,n=n-1|0;var i=0|e.words[0],a=0|t.words[0],s=i*a,o=67108863&s,u=s/67108864|0;r.words[0]=o;for(var c=1;c<n;c++){for(var f=u>>>26,d=67108863&u,l=Math.min(c,t.length-1),h=Math.max(0,c-e.length+1);h<=l;h++){var p=c-h|0;f+=(s=(i=0|e.words[p])*(a=0|t.words[h])+d)/67108864|0,d=67108863&s}r.words[c]=0|d,u=0|f}return 0!==u?r.words[c]=0|u:r.length--,r.strip()}a.prototype.toString=function(e,t){var r;if(t=0|t||1,16===(e=e||10)||"hex"===e){r="";for(var i=0,a=0,s=0;s<this.length;s++){var o=this.words[s],u=(16777215&(o<<i|a)).toString(16);r=0!==(a=o>>>24-i&16777215)||s!==this.length-1?c[6-u.length]+u+r:u+r,(i+=2)>=26&&(i-=26,s--)}for(0!==a&&(r=a.toString(16)+r);r.length%t!=0;)r="0"+r;return 0!==this.negative&&(r="-"+r),r}if(e===(0|e)&&e>=2&&e<=36){var l=f[e],h=d[e];r="";var p=this.clone();for(p.negative=0;!p.isZero();){var y=p.modn(h).toString(e);r=(p=p.idivn(h)).isZero()?y+r:c[l-y.length]+y+r}for(this.isZero()&&(r="0"+r);r.length%t!=0;)r="0"+r;return 0!==this.negative&&(r="-"+r),r}n(!1,"Base should be between 2 and 36")},a.prototype.toNumber=function(){var e=this.words[0];return 2===this.length?e+=67108864*this.words[1]:3===this.length&&1===this.words[2]?e+=4503599627370496+67108864*this.words[1]:this.length>2&&n(!1,"Number can only safely store up to 53 bits"),0!==this.negative?-e:e},a.prototype.toJSON=function(){return this.toString(16)},a.prototype.toBuffer=function(e,t){return n(void 0!==s),this.toArrayLike(s,e,t)},a.prototype.toArray=function(e,t){return this.toArrayLike(Array,e,t)},a.prototype.toArrayLike=function(e,t,r){var i=this.byteLength(),a=r||Math.max(1,i);n(i<=a,"byte array longer than desired length"),n(a>0,"Requested array length <= 0"),this.strip();var s,o,u="le"===t,c=new e(a),f=this.clone();if(u){for(o=0;!f.isZero();o++)s=f.andln(255),f.iushrn(8),c[o]=s;for(;o<a;o++)c[o]=0}else{for(o=0;o<a-i;o++)c[o]=0;for(o=0;!f.isZero();o++)s=f.andln(255),f.iushrn(8),c[a-o-1]=s}return c},Math.clz32?a.prototype._countBits=function(e){return 32-Math.clz32(e)}:a.prototype._countBits=function(e){var t=e,r=0;return t>=4096&&(r+=13,t>>>=13),t>=64&&(r+=7,t>>>=7),t>=8&&(r+=4,t>>>=4),t>=2&&(r+=2,t>>>=2),r+t},a.prototype._zeroBits=function(e){if(0===e)return 26;var t=e,r=0;return 0==(8191&t)&&(r+=13,t>>>=13),0==(127&t)&&(r+=7,t>>>=7),0==(15&t)&&(r+=4,t>>>=4),0==(3&t)&&(r+=2,t>>>=2),0==(1&t)&&r++,r},a.prototype.bitLength=function(){var e=this.words[this.length-1],t=this._countBits(e);return 26*(this.length-1)+t},a.prototype.zeroBits=function(){if(this.isZero())return 0;for(var e=0,t=0;t<this.length;t++){var r=this._zeroBits(this.words[t]);if(e+=r,26!==r)break}return e},a.prototype.byteLength=function(){return Math.ceil(this.bitLength()/8)},a.prototype.toTwos=function(e){return 0!==this.negative?this.abs().inotn(e).iaddn(1):this.clone()},a.prototype.fromTwos=function(e){return this.testn(e-1)?this.notn(e).iaddn(1).ineg():this.clone()},a.prototype.isNeg=function(){return 0!==this.negative},a.prototype.neg=function(){return this.clone().ineg()},a.prototype.ineg=function(){return this.isZero()||(this.negative^=1),this},a.prototype.iuor=function(e){for(;this.length<e.length;)this.words[this.length++]=0;for(var t=0;t<e.length;t++)this.words[t]=this.words[t]|e.words[t];return this.strip()},a.prototype.ior=function(e){return n(0==(this.negative|e.negative)),this.iuor(e)},a.prototype.or=function(e){return this.length>e.length?this.clone().ior(e):e.clone().ior(this)},a.prototype.uor=function(e){return this.length>e.length?this.clone().iuor(e):e.clone().iuor(this)},a.prototype.iuand=function(e){var t;t=this.length>e.length?e:this;for(var r=0;r<t.length;r++)this.words[r]=this.words[r]&e.words[r];return this.length=t.length,this.strip()},a.prototype.iand=function(e){return n(0==(this.negative|e.negative)),this.iuand(e)},a.prototype.and=function(e){return this.length>e.length?this.clone().iand(e):e.clone().iand(this)},a.prototype.uand=function(e){return this.length>e.length?this.clone().iuand(e):e.clone().iuand(this)},a.prototype.iuxor=function(e){var t,r;this.length>e.length?(t=this,r=e):(t=e,r=this);for(var n=0;n<r.length;n++)this.words[n]=t.words[n]^r.words[n];if(this!==t)for(;n<t.length;n++)this.words[n]=t.words[n];return this.length=t.length,this.strip()},a.prototype.ixor=function(e){return n(0==(this.negative|e.negative)),this.iuxor(e)},a.prototype.xor=function(e){return this.length>e.length?this.clone().ixor(e):e.clone().ixor(this)},a.prototype.uxor=function(e){return this.length>e.length?this.clone().iuxor(e):e.clone().iuxor(this)},a.prototype.inotn=function(e){n("number"==typeof e&&e>=0);var t=0|Math.ceil(e/26),r=e%26;this._expand(t),r>0&&t--;for(var i=0;i<t;i++)this.words[i]=67108863&~this.words[i];return r>0&&(this.words[i]=~this.words[i]&67108863>>26-r),this.strip()},a.prototype.notn=function(e){return this.clone().inotn(e)},a.prototype.setn=function(e,t){n("number"==typeof e&&e>=0);var r=e/26|0,i=e%26;return this._expand(r+1),this.words[r]=t?this.words[r]|1<<i:this.words[r]&~(1<<i),this.strip()},a.prototype.iadd=function(e){var t,r,n;if(0!==this.negative&&0===e.negative)return this.negative=0,t=this.isub(e),this.negative^=1,this._normSign();if(0===this.negative&&0!==e.negative)return e.negative=0,t=this.isub(e),e.negative=1,t._normSign();this.length>e.length?(r=this,n=e):(r=e,n=this);for(var i=0,a=0;a<n.length;a++)t=(0|r.words[a])+(0|n.words[a])+i,this.words[a]=67108863&t,i=t>>>26;for(;0!==i&&a<r.length;a++)t=(0|r.words[a])+i,this.words[a]=67108863&t,i=t>>>26;if(this.length=r.length,0!==i)this.words[this.length]=i,this.length++;else if(r!==this)for(;a<r.length;a++)this.words[a]=r.words[a];return this},a.prototype.add=function(e){var t;return 0!==e.negative&&0===this.negative?(e.negative=0,t=this.sub(e),e.negative^=1,t):0===e.negative&&0!==this.negative?(this.negative=0,t=e.sub(this),this.negative=1,t):this.length>e.length?this.clone().iadd(e):e.clone().iadd(this)},a.prototype.isub=function(e){if(0!==e.negative){e.negative=0;var t=this.iadd(e);return e.negative=1,t._normSign()}if(0!==this.negative)return this.negative=0,this.iadd(e),this.negative=1,this._normSign();var r,n,i=this.cmp(e);if(0===i)return this.negative=0,this.length=1,this.words[0]=0,this;i>0?(r=this,n=e):(r=e,n=this);for(var a=0,s=0;s<n.length;s++)a=(t=(0|r.words[s])-(0|n.words[s])+a)>>26,this.words[s]=67108863&t;for(;0!==a&&s<r.length;s++)a=(t=(0|r.words[s])+a)>>26,this.words[s]=67108863&t;if(0===a&&s<r.length&&r!==this)for(;s<r.length;s++)this.words[s]=r.words[s];return this.length=Math.max(this.length,s),r!==this&&(this.negative=1),this.strip()},a.prototype.sub=function(e){return this.clone().isub(e)};var h=function(e,t,r){var n,i,a,s=e.words,o=t.words,u=r.words,c=0,f=0|s[0],d=8191&f,l=f>>>13,h=0|s[1],p=8191&h,y=h>>>13,b=0|s[2],m=8191&b,g=b>>>13,w=0|s[3],_=8191&w,v=w>>>13,k=0|s[4],A=8191&k,S=k>>>13,E=0|s[5],P=8191&E,x=E>>>13,M=0|s[6],C=8191&M,j=M>>>13,R=0|s[7],B=8191&R,K=R>>>13,I=0|s[8],U=8191&I,T=I>>>13,z=0|s[9],O=8191&z,D=z>>>13,N=0|o[0],q=8191&N,F=N>>>13,L=0|o[1],W=8191&L,H=L>>>13,Z=0|o[2],G=8191&Z,V=Z>>>13,Y=0|o[3],X=8191&Y,$=Y>>>13,J=0|o[4],Q=8191&J,ee=J>>>13,te=0|o[5],re=8191&te,ne=te>>>13,ie=0|o[6],ae=8191&ie,se=ie>>>13,oe=0|o[7],ue=8191&oe,ce=oe>>>13,fe=0|o[8],de=8191&fe,le=fe>>>13,he=0|o[9],pe=8191&he,ye=he>>>13;r.negative=e.negative^t.negative,r.length=19;var be=(c+(n=Math.imul(d,q))|0)+((8191&(i=(i=Math.imul(d,F))+Math.imul(l,q)|0))<<13)|0;c=((a=Math.imul(l,F))+(i>>>13)|0)+(be>>>26)|0,be&=67108863,n=Math.imul(p,q),i=(i=Math.imul(p,F))+Math.imul(y,q)|0,a=Math.imul(y,F);var me=(c+(n=n+Math.imul(d,W)|0)|0)+((8191&(i=(i=i+Math.imul(d,H)|0)+Math.imul(l,W)|0))<<13)|0;c=((a=a+Math.imul(l,H)|0)+(i>>>13)|0)+(me>>>26)|0,me&=67108863,n=Math.imul(m,q),i=(i=Math.imul(m,F))+Math.imul(g,q)|0,a=Math.imul(g,F),n=n+Math.imul(p,W)|0,i=(i=i+Math.imul(p,H)|0)+Math.imul(y,W)|0,a=a+Math.imul(y,H)|0;var ge=(c+(n=n+Math.imul(d,G)|0)|0)+((8191&(i=(i=i+Math.imul(d,V)|0)+Math.imul(l,G)|0))<<13)|0;c=((a=a+Math.imul(l,V)|0)+(i>>>13)|0)+(ge>>>26)|0,ge&=67108863,n=Math.imul(_,q),i=(i=Math.imul(_,F))+Math.imul(v,q)|0,a=Math.imul(v,F),n=n+Math.imul(m,W)|0,i=(i=i+Math.imul(m,H)|0)+Math.imul(g,W)|0,a=a+Math.imul(g,H)|0,n=n+Math.imul(p,G)|0,i=(i=i+Math.imul(p,V)|0)+Math.imul(y,G)|0,a=a+Math.imul(y,V)|0;var we=(c+(n=n+Math.imul(d,X)|0)|0)+((8191&(i=(i=i+Math.imul(d,$)|0)+Math.imul(l,X)|0))<<13)|0;c=((a=a+Math.imul(l,$)|0)+(i>>>13)|0)+(we>>>26)|0,we&=67108863,n=Math.imul(A,q),i=(i=Math.imul(A,F))+Math.imul(S,q)|0,a=Math.imul(S,F),n=n+Math.imul(_,W)|0,i=(i=i+Math.imul(_,H)|0)+Math.imul(v,W)|0,a=a+Math.imul(v,H)|0,n=n+Math.imul(m,G)|0,i=(i=i+Math.imul(m,V)|0)+Math.imul(g,G)|0,a=a+Math.imul(g,V)|0,n=n+Math.imul(p,X)|0,i=(i=i+Math.imul(p,$)|0)+Math.imul(y,X)|0,a=a+Math.imul(y,$)|0;var _e=(c+(n=n+Math.imul(d,Q)|0)|0)+((8191&(i=(i=i+Math.imul(d,ee)|0)+Math.imul(l,Q)|0))<<13)|0;c=((a=a+Math.imul(l,ee)|0)+(i>>>13)|0)+(_e>>>26)|0,_e&=67108863,n=Math.imul(P,q),i=(i=Math.imul(P,F))+Math.imul(x,q)|0,a=Math.imul(x,F),n=n+Math.imul(A,W)|0,i=(i=i+Math.imul(A,H)|0)+Math.imul(S,W)|0,a=a+Math.imul(S,H)|0,n=n+Math.imul(_,G)|0,i=(i=i+Math.imul(_,V)|0)+Math.imul(v,G)|0,a=a+Math.imul(v,V)|0,n=n+Math.imul(m,X)|0,i=(i=i+Math.imul(m,$)|0)+Math.imul(g,X)|0,a=a+Math.imul(g,$)|0,n=n+Math.imul(p,Q)|0,i=(i=i+Math.imul(p,ee)|0)+Math.imul(y,Q)|0,a=a+Math.imul(y,ee)|0;var ve=(c+(n=n+Math.imul(d,re)|0)|0)+((8191&(i=(i=i+Math.imul(d,ne)|0)+Math.imul(l,re)|0))<<13)|0;c=((a=a+Math.imul(l,ne)|0)+(i>>>13)|0)+(ve>>>26)|0,ve&=67108863,n=Math.imul(C,q),i=(i=Math.imul(C,F))+Math.imul(j,q)|0,a=Math.imul(j,F),n=n+Math.imul(P,W)|0,i=(i=i+Math.imul(P,H)|0)+Math.imul(x,W)|0,a=a+Math.imul(x,H)|0,n=n+Math.imul(A,G)|0,i=(i=i+Math.imul(A,V)|0)+Math.imul(S,G)|0,a=a+Math.imul(S,V)|0,n=n+Math.imul(_,X)|0,i=(i=i+Math.imul(_,$)|0)+Math.imul(v,X)|0,a=a+Math.imul(v,$)|0,n=n+Math.imul(m,Q)|0,i=(i=i+Math.imul(m,ee)|0)+Math.imul(g,Q)|0,a=a+Math.imul(g,ee)|0,n=n+Math.imul(p,re)|0,i=(i=i+Math.imul(p,ne)|0)+Math.imul(y,re)|0,a=a+Math.imul(y,ne)|0;var ke=(c+(n=n+Math.imul(d,ae)|0)|0)+((8191&(i=(i=i+Math.imul(d,se)|0)+Math.imul(l,ae)|0))<<13)|0;c=((a=a+Math.imul(l,se)|0)+(i>>>13)|0)+(ke>>>26)|0,ke&=67108863,n=Math.imul(B,q),i=(i=Math.imul(B,F))+Math.imul(K,q)|0,a=Math.imul(K,F),n=n+Math.imul(C,W)|0,i=(i=i+Math.imul(C,H)|0)+Math.imul(j,W)|0,a=a+Math.imul(j,H)|0,n=n+Math.imul(P,G)|0,i=(i=i+Math.imul(P,V)|0)+Math.imul(x,G)|0,a=a+Math.imul(x,V)|0,n=n+Math.imul(A,X)|0,i=(i=i+Math.imul(A,$)|0)+Math.imul(S,X)|0,a=a+Math.imul(S,$)|0,n=n+Math.imul(_,Q)|0,i=(i=i+Math.imul(_,ee)|0)+Math.imul(v,Q)|0,a=a+Math.imul(v,ee)|0,n=n+Math.imul(m,re)|0,i=(i=i+Math.imul(m,ne)|0)+Math.imul(g,re)|0,a=a+Math.imul(g,ne)|0,n=n+Math.imul(p,ae)|0,i=(i=i+Math.imul(p,se)|0)+Math.imul(y,ae)|0,a=a+Math.imul(y,se)|0;var Ae=(c+(n=n+Math.imul(d,ue)|0)|0)+((8191&(i=(i=i+Math.imul(d,ce)|0)+Math.imul(l,ue)|0))<<13)|0;c=((a=a+Math.imul(l,ce)|0)+(i>>>13)|0)+(Ae>>>26)|0,Ae&=67108863,n=Math.imul(U,q),i=(i=Math.imul(U,F))+Math.imul(T,q)|0,a=Math.imul(T,F),n=n+Math.imul(B,W)|0,i=(i=i+Math.imul(B,H)|0)+Math.imul(K,W)|0,a=a+Math.imul(K,H)|0,n=n+Math.imul(C,G)|0,i=(i=i+Math.imul(C,V)|0)+Math.imul(j,G)|0,a=a+Math.imul(j,V)|0,n=n+Math.imul(P,X)|0,i=(i=i+Math.imul(P,$)|0)+Math.imul(x,X)|0,a=a+Math.imul(x,$)|0,n=n+Math.imul(A,Q)|0,i=(i=i+Math.imul(A,ee)|0)+Math.imul(S,Q)|0,a=a+Math.imul(S,ee)|0,n=n+Math.imul(_,re)|0,i=(i=i+Math.imul(_,ne)|0)+Math.imul(v,re)|0,a=a+Math.imul(v,ne)|0,n=n+Math.imul(m,ae)|0,i=(i=i+Math.imul(m,se)|0)+Math.imul(g,ae)|0,a=a+Math.imul(g,se)|0,n=n+Math.imul(p,ue)|0,i=(i=i+Math.imul(p,ce)|0)+Math.imul(y,ue)|0,a=a+Math.imul(y,ce)|0;var Se=(c+(n=n+Math.imul(d,de)|0)|0)+((8191&(i=(i=i+Math.imul(d,le)|0)+Math.imul(l,de)|0))<<13)|0;c=((a=a+Math.imul(l,le)|0)+(i>>>13)|0)+(Se>>>26)|0,Se&=67108863,n=Math.imul(O,q),i=(i=Math.imul(O,F))+Math.imul(D,q)|0,a=Math.imul(D,F),n=n+Math.imul(U,W)|0,i=(i=i+Math.imul(U,H)|0)+Math.imul(T,W)|0,a=a+Math.imul(T,H)|0,n=n+Math.imul(B,G)|0,i=(i=i+Math.imul(B,V)|0)+Math.imul(K,G)|0,a=a+Math.imul(K,V)|0,n=n+Math.imul(C,X)|0,i=(i=i+Math.imul(C,$)|0)+Math.imul(j,X)|0,a=a+Math.imul(j,$)|0,n=n+Math.imul(P,Q)|0,i=(i=i+Math.imul(P,ee)|0)+Math.imul(x,Q)|0,a=a+Math.imul(x,ee)|0,n=n+Math.imul(A,re)|0,i=(i=i+Math.imul(A,ne)|0)+Math.imul(S,re)|0,a=a+Math.imul(S,ne)|0,n=n+Math.imul(_,ae)|0,i=(i=i+Math.imul(_,se)|0)+Math.imul(v,ae)|0,a=a+Math.imul(v,se)|0,n=n+Math.imul(m,ue)|0,i=(i=i+Math.imul(m,ce)|0)+Math.imul(g,ue)|0,a=a+Math.imul(g,ce)|0,n=n+Math.imul(p,de)|0,i=(i=i+Math.imul(p,le)|0)+Math.imul(y,de)|0,a=a+Math.imul(y,le)|0;var Ee=(c+(n=n+Math.imul(d,pe)|0)|0)+((8191&(i=(i=i+Math.imul(d,ye)|0)+Math.imul(l,pe)|0))<<13)|0;c=((a=a+Math.imul(l,ye)|0)+(i>>>13)|0)+(Ee>>>26)|0,Ee&=67108863,n=Math.imul(O,W),i=(i=Math.imul(O,H))+Math.imul(D,W)|0,a=Math.imul(D,H),n=n+Math.imul(U,G)|0,i=(i=i+Math.imul(U,V)|0)+Math.imul(T,G)|0,a=a+Math.imul(T,V)|0,n=n+Math.imul(B,X)|0,i=(i=i+Math.imul(B,$)|0)+Math.imul(K,X)|0,a=a+Math.imul(K,$)|0,n=n+Math.imul(C,Q)|0,i=(i=i+Math.imul(C,ee)|0)+Math.imul(j,Q)|0,a=a+Math.imul(j,ee)|0,n=n+Math.imul(P,re)|0,i=(i=i+Math.imul(P,ne)|0)+Math.imul(x,re)|0,a=a+Math.imul(x,ne)|0,n=n+Math.imul(A,ae)|0,i=(i=i+Math.imul(A,se)|0)+Math.imul(S,ae)|0,a=a+Math.imul(S,se)|0,n=n+Math.imul(_,ue)|0,i=(i=i+Math.imul(_,ce)|0)+Math.imul(v,ue)|0,a=a+Math.imul(v,ce)|0,n=n+Math.imul(m,de)|0,i=(i=i+Math.imul(m,le)|0)+Math.imul(g,de)|0,a=a+Math.imul(g,le)|0;var Pe=(c+(n=n+Math.imul(p,pe)|0)|0)+((8191&(i=(i=i+Math.imul(p,ye)|0)+Math.imul(y,pe)|0))<<13)|0;c=((a=a+Math.imul(y,ye)|0)+(i>>>13)|0)+(Pe>>>26)|0,Pe&=67108863,n=Math.imul(O,G),i=(i=Math.imul(O,V))+Math.imul(D,G)|0,a=Math.imul(D,V),n=n+Math.imul(U,X)|0,i=(i=i+Math.imul(U,$)|0)+Math.imul(T,X)|0,a=a+Math.imul(T,$)|0,n=n+Math.imul(B,Q)|0,i=(i=i+Math.imul(B,ee)|0)+Math.imul(K,Q)|0,a=a+Math.imul(K,ee)|0,n=n+Math.imul(C,re)|0,i=(i=i+Math.imul(C,ne)|0)+Math.imul(j,re)|0,a=a+Math.imul(j,ne)|0,n=n+Math.imul(P,ae)|0,i=(i=i+Math.imul(P,se)|0)+Math.imul(x,ae)|0,a=a+Math.imul(x,se)|0,n=n+Math.imul(A,ue)|0,i=(i=i+Math.imul(A,ce)|0)+Math.imul(S,ue)|0,a=a+Math.imul(S,ce)|0,n=n+Math.imul(_,de)|0,i=(i=i+Math.imul(_,le)|0)+Math.imul(v,de)|0,a=a+Math.imul(v,le)|0;var xe=(c+(n=n+Math.imul(m,pe)|0)|0)+((8191&(i=(i=i+Math.imul(m,ye)|0)+Math.imul(g,pe)|0))<<13)|0;c=((a=a+Math.imul(g,ye)|0)+(i>>>13)|0)+(xe>>>26)|0,xe&=67108863,n=Math.imul(O,X),i=(i=Math.imul(O,$))+Math.imul(D,X)|0,a=Math.imul(D,$),n=n+Math.imul(U,Q)|0,i=(i=i+Math.imul(U,ee)|0)+Math.imul(T,Q)|0,a=a+Math.imul(T,ee)|0,n=n+Math.imul(B,re)|0,i=(i=i+Math.imul(B,ne)|0)+Math.imul(K,re)|0,a=a+Math.imul(K,ne)|0,n=n+Math.imul(C,ae)|0,i=(i=i+Math.imul(C,se)|0)+Math.imul(j,ae)|0,a=a+Math.imul(j,se)|0,n=n+Math.imul(P,ue)|0,i=(i=i+Math.imul(P,ce)|0)+Math.imul(x,ue)|0,a=a+Math.imul(x,ce)|0,n=n+Math.imul(A,de)|0,i=(i=i+Math.imul(A,le)|0)+Math.imul(S,de)|0,a=a+Math.imul(S,le)|0;var Me=(c+(n=n+Math.imul(_,pe)|0)|0)+((8191&(i=(i=i+Math.imul(_,ye)|0)+Math.imul(v,pe)|0))<<13)|0;c=((a=a+Math.imul(v,ye)|0)+(i>>>13)|0)+(Me>>>26)|0,Me&=67108863,n=Math.imul(O,Q),i=(i=Math.imul(O,ee))+Math.imul(D,Q)|0,a=Math.imul(D,ee),n=n+Math.imul(U,re)|0,i=(i=i+Math.imul(U,ne)|0)+Math.imul(T,re)|0,a=a+Math.imul(T,ne)|0,n=n+Math.imul(B,ae)|0,i=(i=i+Math.imul(B,se)|0)+Math.imul(K,ae)|0,a=a+Math.imul(K,se)|0,n=n+Math.imul(C,ue)|0,i=(i=i+Math.imul(C,ce)|0)+Math.imul(j,ue)|0,a=a+Math.imul(j,ce)|0,n=n+Math.imul(P,de)|0,i=(i=i+Math.imul(P,le)|0)+Math.imul(x,de)|0,a=a+Math.imul(x,le)|0;var Ce=(c+(n=n+Math.imul(A,pe)|0)|0)+((8191&(i=(i=i+Math.imul(A,ye)|0)+Math.imul(S,pe)|0))<<13)|0;c=((a=a+Math.imul(S,ye)|0)+(i>>>13)|0)+(Ce>>>26)|0,Ce&=67108863,n=Math.imul(O,re),i=(i=Math.imul(O,ne))+Math.imul(D,re)|0,a=Math.imul(D,ne),n=n+Math.imul(U,ae)|0,i=(i=i+Math.imul(U,se)|0)+Math.imul(T,ae)|0,a=a+Math.imul(T,se)|0,n=n+Math.imul(B,ue)|0,i=(i=i+Math.imul(B,ce)|0)+Math.imul(K,ue)|0,a=a+Math.imul(K,ce)|0,n=n+Math.imul(C,de)|0,i=(i=i+Math.imul(C,le)|0)+Math.imul(j,de)|0,a=a+Math.imul(j,le)|0;var je=(c+(n=n+Math.imul(P,pe)|0)|0)+((8191&(i=(i=i+Math.imul(P,ye)|0)+Math.imul(x,pe)|0))<<13)|0;c=((a=a+Math.imul(x,ye)|0)+(i>>>13)|0)+(je>>>26)|0,je&=67108863,n=Math.imul(O,ae),i=(i=Math.imul(O,se))+Math.imul(D,ae)|0,a=Math.imul(D,se),n=n+Math.imul(U,ue)|0,i=(i=i+Math.imul(U,ce)|0)+Math.imul(T,ue)|0,a=a+Math.imul(T,ce)|0,n=n+Math.imul(B,de)|0,i=(i=i+Math.imul(B,le)|0)+Math.imul(K,de)|0,a=a+Math.imul(K,le)|0;var Re=(c+(n=n+Math.imul(C,pe)|0)|0)+((8191&(i=(i=i+Math.imul(C,ye)|0)+Math.imul(j,pe)|0))<<13)|0;c=((a=a+Math.imul(j,ye)|0)+(i>>>13)|0)+(Re>>>26)|0,Re&=67108863,n=Math.imul(O,ue),i=(i=Math.imul(O,ce))+Math.imul(D,ue)|0,a=Math.imul(D,ce),n=n+Math.imul(U,de)|0,i=(i=i+Math.imul(U,le)|0)+Math.imul(T,de)|0,a=a+Math.imul(T,le)|0;var Be=(c+(n=n+Math.imul(B,pe)|0)|0)+((8191&(i=(i=i+Math.imul(B,ye)|0)+Math.imul(K,pe)|0))<<13)|0;c=((a=a+Math.imul(K,ye)|0)+(i>>>13)|0)+(Be>>>26)|0,Be&=67108863,n=Math.imul(O,de),i=(i=Math.imul(O,le))+Math.imul(D,de)|0,a=Math.imul(D,le);var Ke=(c+(n=n+Math.imul(U,pe)|0)|0)+((8191&(i=(i=i+Math.imul(U,ye)|0)+Math.imul(T,pe)|0))<<13)|0;c=((a=a+Math.imul(T,ye)|0)+(i>>>13)|0)+(Ke>>>26)|0,Ke&=67108863;var Ie=(c+(n=Math.imul(O,pe))|0)+((8191&(i=(i=Math.imul(O,ye))+Math.imul(D,pe)|0))<<13)|0;return c=((a=Math.imul(D,ye))+(i>>>13)|0)+(Ie>>>26)|0,Ie&=67108863,u[0]=be,u[1]=me,u[2]=ge,u[3]=we,u[4]=_e,u[5]=ve,u[6]=ke,u[7]=Ae,u[8]=Se,u[9]=Ee,u[10]=Pe,u[11]=xe,u[12]=Me,u[13]=Ce,u[14]=je,u[15]=Re,u[16]=Be,u[17]=Ke,u[18]=Ie,0!==c&&(u[19]=c,r.length++),r};function p(e,t,r){return(new y).mulp(e,t,r)}function y(e,t){this.x=e,this.y=t}Math.imul||(h=l),a.prototype.mulTo=function(e,t){var r=this.length+e.length;return 10===this.length&&10===e.length?h(this,e,t):r<63?l(this,e,t):r<1024?function(e,t,r){r.negative=t.negative^e.negative,r.length=e.length+t.length;for(var n=0,i=0,a=0;a<r.length-1;a++){var s=i;i=0;for(var o=67108863&n,u=Math.min(a,t.length-1),c=Math.max(0,a-e.length+1);c<=u;c++){var f=a-c,d=(0|e.words[f])*(0|t.words[c]),l=67108863&d;o=67108863&(l=l+o|0),i+=(s=(s=s+(d/67108864|0)|0)+(l>>>26)|0)>>>26,s&=67108863}r.words[a]=o,n=s,s=i}return 0!==n?r.words[a]=n:r.length--,r.strip()}(this,e,t):p(this,e,t)},y.prototype.makeRBT=function(e){for(var t=new Array(e),r=a.prototype._countBits(e)-1,n=0;n<e;n++)t[n]=this.revBin(n,r,e);return t},y.prototype.revBin=function(e,t,r){if(0===e||e===r-1)return e;for(var n=0,i=0;i<t;i++)n|=(1&e)<<t-i-1,e>>=1;return n},y.prototype.permute=function(e,t,r,n,i,a){for(var s=0;s<a;s++)n[s]=t[e[s]],i[s]=r[e[s]]},y.prototype.transform=function(e,t,r,n,i,a){this.permute(a,e,t,r,n,i);for(var s=1;s<i;s<<=1)for(var o=s<<1,u=Math.cos(2*Math.PI/o),c=Math.sin(2*Math.PI/o),f=0;f<i;f+=o)for(var d=u,l=c,h=0;h<s;h++){var p=r[f+h],y=n[f+h],b=r[f+h+s],m=n[f+h+s],g=d*b-l*m;m=d*m+l*b,b=g,r[f+h]=p+b,n[f+h]=y+m,r[f+h+s]=p-b,n[f+h+s]=y-m,h!==o&&(g=u*d-c*l,l=u*l+c*d,d=g)}},y.prototype.guessLen13b=function(e,t){var r=1|Math.max(t,e),n=1&r,i=0;for(r=r/2|0;r;r>>>=1)i++;return 1<<i+1+n},y.prototype.conjugate=function(e,t,r){if(!(r<=1))for(var n=0;n<r/2;n++){var i=e[n];e[n]=e[r-n-1],e[r-n-1]=i,i=t[n],t[n]=-t[r-n-1],t[r-n-1]=-i}},y.prototype.normalize13b=function(e,t){for(var r=0,n=0;n<t/2;n++){var i=8192*Math.round(e[2*n+1]/t)+Math.round(e[2*n]/t)+r;e[n]=67108863&i,r=i<67108864?0:i/67108864|0}return e},y.prototype.convert13b=function(e,t,r,i){for(var a=0,s=0;s<t;s++)a+=0|e[s],r[2*s]=8191&a,a>>>=13,r[2*s+1]=8191&a,a>>>=13;for(s=2*t;s<i;++s)r[s]=0;n(0===a),n(0==(-8192&a))},y.prototype.stub=function(e){for(var t=new Array(e),r=0;r<e;r++)t[r]=0;return t},y.prototype.mulp=function(e,t,r){var n=2*this.guessLen13b(e.length,t.length),i=this.makeRBT(n),a=this.stub(n),s=new Array(n),o=new Array(n),u=new Array(n),c=new Array(n),f=new Array(n),d=new Array(n),l=r.words;l.length=n,this.convert13b(e.words,e.length,s,n),this.convert13b(t.words,t.length,c,n),this.transform(s,a,o,u,n,i),this.transform(c,a,f,d,n,i);for(var h=0;h<n;h++){var p=o[h]*f[h]-u[h]*d[h];u[h]=o[h]*d[h]+u[h]*f[h],o[h]=p}return this.conjugate(o,u,n),this.transform(o,u,l,a,n,i),this.conjugate(l,a,n),this.normalize13b(l,n),r.negative=e.negative^t.negative,r.length=e.length+t.length,r.strip()},a.prototype.mul=function(e){var t=new a(null);return t.words=new Array(this.length+e.length),this.mulTo(e,t)},a.prototype.mulf=function(e){var t=new a(null);return t.words=new Array(this.length+e.length),p(this,e,t)},a.prototype.imul=function(e){return this.clone().mulTo(e,this)},a.prototype.imuln=function(e){n("number"==typeof e),n(e<67108864);for(var t=0,r=0;r<this.length;r++){var i=(0|this.words[r])*e,a=(67108863&i)+(67108863&t);t>>=26,t+=i/67108864|0,t+=a>>>26,this.words[r]=67108863&a}return 0!==t&&(this.words[r]=t,this.length++),this},a.prototype.muln=function(e){return this.clone().imuln(e)},a.prototype.sqr=function(){return this.mul(this)},a.prototype.isqr=function(){return this.imul(this.clone())},a.prototype.pow=function(e){var t=function(e){for(var t=new Array(e.bitLength()),r=0;r<t.length;r++){var n=r/26|0,i=r%26;t[r]=(e.words[n]&1<<i)>>>i}return t}(e);if(0===t.length)return new a(1);for(var r=this,n=0;n<t.length&&0===t[n];n++,r=r.sqr());if(++n<t.length)for(var i=r.sqr();n<t.length;n++,i=i.sqr())0!==t[n]&&(r=r.mul(i));return r},a.prototype.iushln=function(e){n("number"==typeof e&&e>=0);var t,r=e%26,i=(e-r)/26,a=67108863>>>26-r<<26-r;if(0!==r){var s=0;for(t=0;t<this.length;t++){var o=this.words[t]&a,u=(0|this.words[t])-o<<r;this.words[t]=u|s,s=o>>>26-r}s&&(this.words[t]=s,this.length++)}if(0!==i){for(t=this.length-1;t>=0;t--)this.words[t+i]=this.words[t];for(t=0;t<i;t++)this.words[t]=0;this.length+=i}return this.strip()},a.prototype.ishln=function(e){return n(0===this.negative),this.iushln(e)},a.prototype.iushrn=function(e,t,r){var i;n("number"==typeof e&&e>=0),i=t?(t-t%26)/26:0;var a=e%26,s=Math.min((e-a)/26,this.length),o=67108863^67108863>>>a<<a,u=r;if(i-=s,i=Math.max(0,i),u){for(var c=0;c<s;c++)u.words[c]=this.words[c];u.length=s}if(0===s);else if(this.length>s)for(this.length-=s,c=0;c<this.length;c++)this.words[c]=this.words[c+s];else this.words[0]=0,this.length=1;var f=0;for(c=this.length-1;c>=0&&(0!==f||c>=i);c--){var d=0|this.words[c];this.words[c]=f<<26-a|d>>>a,f=d&o}return u&&0!==f&&(u.words[u.length++]=f),0===this.length&&(this.words[0]=0,this.length=1),this.strip()},a.prototype.ishrn=function(e,t,r){return n(0===this.negative),this.iushrn(e,t,r)},a.prototype.shln=function(e){return this.clone().ishln(e)},a.prototype.ushln=function(e){return this.clone().iushln(e)},a.prototype.shrn=function(e){return this.clone().ishrn(e)},a.prototype.ushrn=function(e){return this.clone().iushrn(e)},a.prototype.testn=function(e){n("number"==typeof e&&e>=0);var t=e%26,r=(e-t)/26,i=1<<t;return!(this.length<=r)&&!!(this.words[r]&i)},a.prototype.imaskn=function(e){n("number"==typeof e&&e>=0);var t=e%26,r=(e-t)/26;if(n(0===this.negative,"imaskn works only with positive numbers"),this.length<=r)return this;if(0!==t&&r++,this.length=Math.min(r,this.length),0!==t){var i=67108863^67108863>>>t<<t;this.words[this.length-1]&=i}return this.strip()},a.prototype.maskn=function(e){return this.clone().imaskn(e)},a.prototype.iaddn=function(e){return n("number"==typeof e),n(e<67108864),e<0?this.isubn(-e):0!==this.negative?1===this.length&&(0|this.words[0])<e?(this.words[0]=e-(0|this.words[0]),this.negative=0,this):(this.negative=0,this.isubn(e),this.negative=1,this):this._iaddn(e)},a.prototype._iaddn=function(e){this.words[0]+=e;for(var t=0;t<this.length&&this.words[t]>=67108864;t++)this.words[t]-=67108864,t===this.length-1?this.words[t+1]=1:this.words[t+1]++;return this.length=Math.max(this.length,t+1),this},a.prototype.isubn=function(e){if(n("number"==typeof e),n(e<67108864),e<0)return this.iaddn(-e);if(0!==this.negative)return this.negative=0,this.iaddn(e),this.negative=1,this;if(this.words[0]-=e,1===this.length&&this.words[0]<0)this.words[0]=-this.words[0],this.negative=1;else for(var t=0;t<this.length&&this.words[t]<0;t++)this.words[t]+=67108864,this.words[t+1]-=1;return this.strip()},a.prototype.addn=function(e){return this.clone().iaddn(e)},a.prototype.subn=function(e){return this.clone().isubn(e)},a.prototype.iabs=function(){return this.negative=0,this},a.prototype.abs=function(){return this.clone().iabs()},a.prototype._ishlnsubmul=function(e,t,r){var i,a,s=e.length+r;this._expand(s);var o=0;for(i=0;i<e.length;i++){a=(0|this.words[i+r])+o;var u=(0|e.words[i])*t;o=((a-=67108863&u)>>26)-(u/67108864|0),this.words[i+r]=67108863&a}for(;i<this.length-r;i++)o=(a=(0|this.words[i+r])+o)>>26,this.words[i+r]=67108863&a;if(0===o)return this.strip();for(n(-1===o),o=0,i=0;i<this.length;i++)o=(a=-(0|this.words[i])+o)>>26,this.words[i]=67108863&a;return this.negative=1,this.strip()},a.prototype._wordDiv=function(e,t){var r=(this.length,e.length),n=this.clone(),i=e,s=0|i.words[i.length-1];0!==(r=26-this._countBits(s))&&(i=i.ushln(r),n.iushln(r),s=0|i.words[i.length-1]);var o,u=n.length-i.length;if("mod"!==t){(o=new a(null)).length=u+1,o.words=new Array(o.length);for(var c=0;c<o.length;c++)o.words[c]=0}var f=n.clone()._ishlnsubmul(i,1,u);0===f.negative&&(n=f,o&&(o.words[u]=1));for(var d=u-1;d>=0;d--){var l=67108864*(0|n.words[i.length+d])+(0|n.words[i.length+d-1]);for(l=Math.min(l/s|0,67108863),n._ishlnsubmul(i,l,d);0!==n.negative;)l--,n.negative=0,n._ishlnsubmul(i,1,d),n.isZero()||(n.negative^=1);o&&(o.words[d]=l)}return o&&o.strip(),n.strip(),"div"!==t&&0!==r&&n.iushrn(r),{div:o||null,mod:n}},a.prototype.divmod=function(e,t,r){return n(!e.isZero()),this.isZero()?{div:new a(0),mod:new a(0)}:0!==this.negative&&0===e.negative?(o=this.neg().divmod(e,t),"mod"!==t&&(i=o.div.neg()),"div"!==t&&(s=o.mod.neg(),r&&0!==s.negative&&s.iadd(e)),{div:i,mod:s}):0===this.negative&&0!==e.negative?(o=this.divmod(e.neg(),t),"mod"!==t&&(i=o.div.neg()),{div:i,mod:o.mod}):0!=(this.negative&e.negative)?(o=this.neg().divmod(e.neg(),t),"div"!==t&&(s=o.mod.neg(),r&&0!==s.negative&&s.isub(e)),{div:o.div,mod:s}):e.length>this.length||this.cmp(e)<0?{div:new a(0),mod:this}:1===e.length?"div"===t?{div:this.divn(e.words[0]),mod:null}:"mod"===t?{div:null,mod:new a(this.modn(e.words[0]))}:{div:this.divn(e.words[0]),mod:new a(this.modn(e.words[0]))}:this._wordDiv(e,t);var i,s,o},a.prototype.div=function(e){return this.divmod(e,"div",!1).div},a.prototype.mod=function(e){return this.divmod(e,"mod",!1).mod},a.prototype.umod=function(e){return this.divmod(e,"mod",!0).mod},a.prototype.divRound=function(e){var t=this.divmod(e);if(t.mod.isZero())return t.div;var r=0!==t.div.negative?t.mod.isub(e):t.mod,n=e.ushrn(1),i=e.andln(1),a=r.cmp(n);return a<0||1===i&&0===a?t.div:0!==t.div.negative?t.div.isubn(1):t.div.iaddn(1)},a.prototype.modn=function(e){n(e<=67108863);for(var t=(1<<26)%e,r=0,i=this.length-1;i>=0;i--)r=(t*r+(0|this.words[i]))%e;return r},a.prototype.idivn=function(e){n(e<=67108863);for(var t=0,r=this.length-1;r>=0;r--){var i=(0|this.words[r])+67108864*t;this.words[r]=i/e|0,t=i%e}return this.strip()},a.prototype.divn=function(e){return this.clone().idivn(e)},a.prototype.egcd=function(e){n(0===e.negative),n(!e.isZero());var t=this,r=e.clone();t=0!==t.negative?t.umod(e):t.clone();for(var i=new a(1),s=new a(0),o=new a(0),u=new a(1),c=0;t.isEven()&&r.isEven();)t.iushrn(1),r.iushrn(1),++c;for(var f=r.clone(),d=t.clone();!t.isZero();){for(var l=0,h=1;0==(t.words[0]&h)&&l<26;++l,h<<=1);if(l>0)for(t.iushrn(l);l-- >0;)(i.isOdd()||s.isOdd())&&(i.iadd(f),s.isub(d)),i.iushrn(1),s.iushrn(1);for(var p=0,y=1;0==(r.words[0]&y)&&p<26;++p,y<<=1);if(p>0)for(r.iushrn(p);p-- >0;)(o.isOdd()||u.isOdd())&&(o.iadd(f),u.isub(d)),o.iushrn(1),u.iushrn(1);t.cmp(r)>=0?(t.isub(r),i.isub(o),s.isub(u)):(r.isub(t),o.isub(i),u.isub(s))}return{a:o,b:u,gcd:r.iushln(c)}},a.prototype._invmp=function(e){n(0===e.negative),n(!e.isZero());var t=this,r=e.clone();t=0!==t.negative?t.umod(e):t.clone();for(var i,s=new a(1),o=new a(0),u=r.clone();t.cmpn(1)>0&&r.cmpn(1)>0;){for(var c=0,f=1;0==(t.words[0]&f)&&c<26;++c,f<<=1);if(c>0)for(t.iushrn(c);c-- >0;)s.isOdd()&&s.iadd(u),s.iushrn(1);for(var d=0,l=1;0==(r.words[0]&l)&&d<26;++d,l<<=1);if(d>0)for(r.iushrn(d);d-- >0;)o.isOdd()&&o.iadd(u),o.iushrn(1);t.cmp(r)>=0?(t.isub(r),s.isub(o)):(r.isub(t),o.isub(s))}return(i=0===t.cmpn(1)?s:o).cmpn(0)<0&&i.iadd(e),i},a.prototype.gcd=function(e){if(this.isZero())return e.abs();if(e.isZero())return this.abs();var t=this.clone(),r=e.clone();t.negative=0,r.negative=0;for(var n=0;t.isEven()&&r.isEven();n++)t.iushrn(1),r.iushrn(1);for(;;){for(;t.isEven();)t.iushrn(1);for(;r.isEven();)r.iushrn(1);var i=t.cmp(r);if(i<0){var a=t;t=r,r=a}else if(0===i||0===r.cmpn(1))break;t.isub(r)}return r.iushln(n)},a.prototype.invm=function(e){return this.egcd(e).a.umod(e)},a.prototype.isEven=function(){return 0==(1&this.words[0])},a.prototype.isOdd=function(){return 1==(1&this.words[0])},a.prototype.andln=function(e){return this.words[0]&e},a.prototype.bincn=function(e){n("number"==typeof e);var t=e%26,r=(e-t)/26,i=1<<t;if(this.length<=r)return this._expand(r+1),this.words[r]|=i,this;for(var a=i,s=r;0!==a&&s<this.length;s++){var o=0|this.words[s];a=(o+=a)>>>26,o&=67108863,this.words[s]=o}return 0!==a&&(this.words[s]=a,this.length++),this},a.prototype.isZero=function(){return 1===this.length&&0===this.words[0]},a.prototype.cmpn=function(e){var t,r=e<0;if(0!==this.negative&&!r)return-1;if(0===this.negative&&r)return 1;if(this.strip(),this.length>1)t=1;else{r&&(e=-e),n(e<=67108863,"Number is too big");var i=0|this.words[0];t=i===e?0:i<e?-1:1}return 0!==this.negative?0|-t:t},a.prototype.cmp=function(e){if(0!==this.negative&&0===e.negative)return-1;if(0===this.negative&&0!==e.negative)return 1;var t=this.ucmp(e);return 0!==this.negative?0|-t:t},a.prototype.ucmp=function(e){if(this.length>e.length)return 1;if(this.length<e.length)return-1;for(var t=0,r=this.length-1;r>=0;r--){var n=0|this.words[r],i=0|e.words[r];if(n!==i){n<i?t=-1:n>i&&(t=1);break}}return t},a.prototype.gtn=function(e){return 1===this.cmpn(e)},a.prototype.gt=function(e){return 1===this.cmp(e)},a.prototype.gten=function(e){return this.cmpn(e)>=0},a.prototype.gte=function(e){return this.cmp(e)>=0},a.prototype.ltn=function(e){return-1===this.cmpn(e)},a.prototype.lt=function(e){return-1===this.cmp(e)},a.prototype.lten=function(e){return this.cmpn(e)<=0},a.prototype.lte=function(e){return this.cmp(e)<=0},a.prototype.eqn=function(e){return 0===this.cmpn(e)},a.prototype.eq=function(e){return 0===this.cmp(e)},a.red=function(e){return new k(e)},a.prototype.toRed=function(e){return n(!this.red,"Already a number in reduction context"),n(0===this.negative,"red works only with positives"),e.convertTo(this)._forceRed(e)},a.prototype.fromRed=function(){return n(this.red,"fromRed works only with numbers in reduction context"),this.red.convertFrom(this)},a.prototype._forceRed=function(e){return this.red=e,this},a.prototype.forceRed=function(e){return n(!this.red,"Already a number in reduction context"),this._forceRed(e)},a.prototype.redAdd=function(e){return n(this.red,"redAdd works only with red numbers"),this.red.add(this,e)},a.prototype.redIAdd=function(e){return n(this.red,"redIAdd works only with red numbers"),this.red.iadd(this,e)},a.prototype.redSub=function(e){return n(this.red,"redSub works only with red numbers"),this.red.sub(this,e)},a.prototype.redISub=function(e){return n(this.red,"redISub works only with red numbers"),this.red.isub(this,e)},a.prototype.redShl=function(e){return n(this.red,"redShl works only with red numbers"),this.red.shl(this,e)},a.prototype.redMul=function(e){return n(this.red,"redMul works only with red numbers"),this.red._verify2(this,e),this.red.mul(this,e)},a.prototype.redIMul=function(e){return n(this.red,"redMul works only with red numbers"),this.red._verify2(this,e),this.red.imul(this,e)},a.prototype.redSqr=function(){return n(this.red,"redSqr works only with red numbers"),this.red._verify1(this),this.red.sqr(this)},a.prototype.redISqr=function(){return n(this.red,"redISqr works only with red numbers"),this.red._verify1(this),this.red.isqr(this)},a.prototype.redSqrt=function(){return n(this.red,"redSqrt works only with red numbers"),this.red._verify1(this),this.red.sqrt(this)},a.prototype.redInvm=function(){return n(this.red,"redInvm works only with red numbers"),this.red._verify1(this),this.red.invm(this)},a.prototype.redNeg=function(){return n(this.red,"redNeg works only with red numbers"),this.red._verify1(this),this.red.neg(this)},a.prototype.redPow=function(e){return n(this.red&&!e.red,"redPow(normalNum)"),this.red._verify1(this),this.red.pow(this,e)};var b={k256:null,p224:null,p192:null,p25519:null};function m(e,t){this.name=e,this.p=new a(t,16),this.n=this.p.bitLength(),this.k=new a(1).iushln(this.n).isub(this.p),this.tmp=this._tmp()}function g(){m.call(this,"k256","ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f")}function w(){m.call(this,"p224","ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001")}function _(){m.call(this,"p192","ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff")}function v(){m.call(this,"25519","7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed")}function k(e){if("string"==typeof e){var t=a._prime(e);this.m=t.p,this.prime=t}else n(e.gtn(1),"modulus must be greater than 1"),this.m=e,this.prime=null}function A(e){k.call(this,e),this.shift=this.m.bitLength(),this.shift%26!=0&&(this.shift+=26-this.shift%26),this.r=new a(1).iushln(this.shift),this.r2=this.imod(this.r.sqr()),this.rinv=this.r._invmp(this.m),this.minv=this.rinv.mul(this.r).isubn(1).div(this.m),this.minv=this.minv.umod(this.r),this.minv=this.r.sub(this.minv)}m.prototype._tmp=function(){var e=new a(null);return e.words=new Array(Math.ceil(this.n/13)),e},m.prototype.ireduce=function(e){var t,r=e;do{this.split(r,this.tmp),t=(r=(r=this.imulK(r)).iadd(this.tmp)).bitLength()}while(t>this.n);var n=t<this.n?-1:r.ucmp(this.p);return 0===n?(r.words[0]=0,r.length=1):n>0?r.isub(this.p):r.strip(),r},m.prototype.split=function(e,t){e.iushrn(this.n,0,t)},m.prototype.imulK=function(e){return e.imul(this.k)},i(g,m),g.prototype.split=function(e,t){for(var r=Math.min(e.length,9),n=0;n<r;n++)t.words[n]=e.words[n];if(t.length=r,e.length<=9)return e.words[0]=0,void(e.length=1);var i=e.words[9];for(t.words[t.length++]=4194303&i,n=10;n<e.length;n++){var a=0|e.words[n];e.words[n-10]=(4194303&a)<<4|i>>>22,i=a}i>>>=22,e.words[n-10]=i,0===i&&e.length>10?e.length-=10:e.length-=9},g.prototype.imulK=function(e){e.words[e.length]=0,e.words[e.length+1]=0,e.length+=2;for(var t=0,r=0;r<e.length;r++){var n=0|e.words[r];t+=977*n,e.words[r]=67108863&t,t=64*n+(t/67108864|0)}return 0===e.words[e.length-1]&&(e.length--,0===e.words[e.length-1]&&e.length--),e},i(w,m),i(_,m),i(v,m),v.prototype.imulK=function(e){for(var t=0,r=0;r<e.length;r++){var n=19*(0|e.words[r])+t,i=67108863&n;n>>>=26,e.words[r]=i,t=n}return 0!==t&&(e.words[e.length++]=t),e},a._prime=function(e){if(b[e])return b[e];var t;if("k256"===e)t=new g;else if("p224"===e)t=new w;else if("p192"===e)t=new _;else{if("p25519"!==e)throw new Error("Unknown prime "+e);t=new v}return b[e]=t,t},k.prototype._verify1=function(e){n(0===e.negative,"red works only with positives"),n(e.red,"red works only with red numbers")},k.prototype._verify2=function(e,t){n(0==(e.negative|t.negative),"red works only with positives"),n(e.red&&e.red===t.red,"red works only with red numbers")},k.prototype.imod=function(e){return this.prime?this.prime.ireduce(e)._forceRed(this):e.umod(this.m)._forceRed(this)},k.prototype.neg=function(e){return e.isZero()?e.clone():this.m.sub(e)._forceRed(this)},k.prototype.add=function(e,t){this._verify2(e,t);var r=e.add(t);return r.cmp(this.m)>=0&&r.isub(this.m),r._forceRed(this)},k.prototype.iadd=function(e,t){this._verify2(e,t);var r=e.iadd(t);return r.cmp(this.m)>=0&&r.isub(this.m),r},k.prototype.sub=function(e,t){this._verify2(e,t);var r=e.sub(t);return r.cmpn(0)<0&&r.iadd(this.m),r._forceRed(this)},k.prototype.isub=function(e,t){this._verify2(e,t);var r=e.isub(t);return r.cmpn(0)<0&&r.iadd(this.m),r},k.prototype.shl=function(e,t){return this._verify1(e),this.imod(e.ushln(t))},k.prototype.imul=function(e,t){return this._verify2(e,t),this.imod(e.imul(t))},k.prototype.mul=function(e,t){return this._verify2(e,t),this.imod(e.mul(t))},k.prototype.isqr=function(e){return this.imul(e,e.clone())},k.prototype.sqr=function(e){return this.mul(e,e)},k.prototype.sqrt=function(e){if(e.isZero())return e.clone();var t=this.m.andln(3);if(n(t%2==1),3===t){var r=this.m.add(new a(1)).iushrn(2);return this.pow(e,r)}for(var i=this.m.subn(1),s=0;!i.isZero()&&0===i.andln(1);)s++,i.iushrn(1);n(!i.isZero());var o=new a(1).toRed(this),u=o.redNeg(),c=this.m.subn(1).iushrn(1),f=this.m.bitLength();for(f=new a(2*f*f).toRed(this);0!==this.pow(f,c).cmp(u);)f.redIAdd(u);for(var d=this.pow(f,i),l=this.pow(e,i.addn(1).iushrn(1)),h=this.pow(e,i),p=s;0!==h.cmp(o);){for(var y=h,b=0;0!==y.cmp(o);b++)y=y.redSqr();n(b<p);var m=this.pow(d,new a(1).iushln(p-b-1));l=l.redMul(m),d=m.redSqr(),h=h.redMul(d),p=b}return l},k.prototype.invm=function(e){var t=e._invmp(this.m);return 0!==t.negative?(t.negative=0,this.imod(t).redNeg()):this.imod(t)},k.prototype.pow=function(e,t){if(t.isZero())return new a(1).toRed(this);if(0===t.cmpn(1))return e.clone();var r=new Array(16);r[0]=new a(1).toRed(this),r[1]=e;for(var n=2;n<r.length;n++)r[n]=this.mul(r[n-1],e);var i=r[0],s=0,o=0,u=t.bitLength()%26;for(0===u&&(u=26),n=t.length-1;n>=0;n--){for(var c=t.words[n],f=u-1;f>=0;f--){var d=c>>f&1;i!==r[0]&&(i=this.sqr(i)),0!==d||0!==s?(s<<=1,s|=d,(4===++o||0===n&&0===f)&&(i=this.mul(i,r[s]),o=0,s=0)):o=0}u=26}return i},k.prototype.convertTo=function(e){var t=e.umod(this.m);return t===e?t.clone():t},k.prototype.convertFrom=function(e){var t=e.clone();return t.red=null,t},a.mont=function(e){return new A(e)},i(A,k),A.prototype.convertTo=function(e){return this.imod(e.ushln(this.shift))},A.prototype.convertFrom=function(e){var t=this.imod(e.mul(this.rinv));return t.red=null,t},A.prototype.imul=function(e,t){if(e.isZero()||t.isZero())return e.words[0]=0,e.length=1,e;var r=e.imul(t),n=r.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),i=r.isub(n).iushrn(this.shift),a=i;return i.cmp(this.m)>=0?a=i.isub(this.m):i.cmpn(0)<0&&(a=i.iadd(this.m)),a._forceRed(this)},A.prototype.mul=function(e,t){if(e.isZero()||t.isZero())return new a(0)._forceRed(this);var r=e.mul(t),n=r.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),i=r.isub(n).iushrn(this.shift),s=i;return i.cmp(this.m)>=0?s=i.isub(this.m):i.cmpn(0)<0&&(s=i.iadd(this.m)),s._forceRed(this)},A.prototype.invm=function(e){return this.imod(e._invmp(this.m).mul(this.r2))._forceRed(this)}}(void 0===t||t,this)},{buffer:"buffer"}],18:[function(e,t,r){var n;function i(e){this.rand=e}if(t.exports=function(e){return n||(n=new i(null)),n.generate(e)},t.exports.Rand=i,i.prototype.generate=function(e){return this._rand(e)},i.prototype._rand=function(e){if(this.rand.getBytes)return this.rand.getBytes(e);for(var t=new Uint8Array(e),r=0;r<t.length;r++)t[r]=this.rand.getByte();return t},"object"==typeof self)self.crypto&&self.crypto.getRandomValues?i.prototype._rand=function(e){var t=new Uint8Array(e);return self.crypto.getRandomValues(t),t}:self.msCrypto&&self.msCrypto.getRandomValues?i.prototype._rand=function(e){var t=new Uint8Array(e);return self.msCrypto.getRandomValues(t),t}:"object"==typeof window&&(i.prototype._rand=function(){throw new Error("Not implemented yet")});else try{var a=e("crypto");if("function"!=typeof a.randomBytes)throw new Error("Not supported");i.prototype._rand=function(e){return a.randomBytes(e)}}catch(s){}},{crypto:"crypto"}],19:[function(e,t,r){"use strict";var n=r;n.version=e("../package.json").version,n.utils=e("./elliptic/utils"),n.rand=e("brorand"),n.curve=e("./elliptic/curve"),n.curves=e("./elliptic/curves"),n.ec=e("./elliptic/ec"),n.eddsa=e("./elliptic/eddsa")},{"../package.json":34,"./elliptic/curve":22,"./elliptic/curves":25,"./elliptic/ec":26,"./elliptic/eddsa":29,"./elliptic/utils":33,brorand:18}],20:[function(e,t,r){"use strict";var n=e("bn.js"),i=e("../../elliptic").utils,a=i.getNAF,s=i.getJSF,o=i.assert;function u(e,t){this.type=e,this.p=new n(t.p,16),this.red=t.prime?n.red(t.prime):n.mont(this.p),this.zero=new n(0).toRed(this.red),this.one=new n(1).toRed(this.red),this.two=new n(2).toRed(this.red),this.n=t.n&&new n(t.n,16),this.g=t.g&&this.pointFromJSON(t.g,t.gRed),this._wnafT1=new Array(4),this._wnafT2=new Array(4),this._wnafT3=new Array(4),this._wnafT4=new Array(4);var r=this.n&&this.p.div(this.n);!r||r.cmpn(100)>0?this.redN=null:(this._maxwellTrick=!0,this.redN=this.n.toRed(this.red))}function c(e,t){this.curve=e,this.type=t,this.precomputed=null}t.exports=u,u.prototype.point=function(){throw new Error("Not implemented")},u.prototype.validate=function(){throw new Error("Not implemented")},u.prototype._fixedNafMul=function(e,t){o(e.precomputed);var r=e._getDoubles(),n=a(t,1),i=(1<<r.step+1)-(r.step%2==0?2:1);i/=3;for(var s=[],u=0;u<n.length;u+=r.step){var c=0;for(t=u+r.step-1;t>=u;t--)c=(c<<1)+n[t];s.push(c)}for(var f=this.jpoint(null,null,null),d=this.jpoint(null,null,null),l=i;l>0;l--){for(u=0;u<s.length;u++){(c=s[u])===l?d=d.mixedAdd(r.points[u]):c===-l&&(d=d.mixedAdd(r.points[u].neg()))}f=f.add(d)}return f.toP()},u.prototype._wnafMul=function(e,t){var r=4,n=e._getNAFPoints(r);r=n.wnd;for(var i=n.points,s=a(t,r),u=this.jpoint(null,null,null),c=s.length-1;c>=0;c--){for(t=0;c>=0&&0===s[c];c--)t++;if(c>=0&&t++,u=u.dblp(t),c<0)break;var f=s[c];o(0!==f),u="affine"===e.type?f>0?u.mixedAdd(i[f-1>>1]):u.mixedAdd(i[-f-1>>1].neg()):f>0?u.add(i[f-1>>1]):u.add(i[-f-1>>1].neg())}return"affine"===e.type?u.toP():u},u.prototype._wnafMulAdd=function(e,t,r,n,i){for(var o=this._wnafT1,u=this._wnafT2,c=this._wnafT3,f=0,d=0;d<n;d++){var l=(E=t[d])._getNAFPoints(e);o[d]=l.wnd,u[d]=l.points}for(d=n-1;d>=1;d-=2){var h=d-1,p=d;if(1===o[h]&&1===o[p]){var y=[t[h],null,null,t[p]];0===t[h].y.cmp(t[p].y)?(y[1]=t[h].add(t[p]),y[2]=t[h].toJ().mixedAdd(t[p].neg())):0===t[h].y.cmp(t[p].y.redNeg())?(y[1]=t[h].toJ().mixedAdd(t[p]),y[2]=t[h].add(t[p].neg())):(y[1]=t[h].toJ().mixedAdd(t[p]),y[2]=t[h].toJ().mixedAdd(t[p].neg()));var b=[-3,-1,-5,-7,0,7,5,1,3],m=s(r[h],r[p]);f=Math.max(m[0].length,f),c[h]=new Array(f),c[p]=new Array(f);for(var g=0;g<f;g++){var w=0|m[0][g],_=0|m[1][g];c[h][g]=b[3*(w+1)+(_+1)],c[p][g]=0,u[h]=y}}else c[h]=a(r[h],o[h]),c[p]=a(r[p],o[p]),f=Math.max(c[h].length,f),f=Math.max(c[p].length,f)}var v=this.jpoint(null,null,null),k=this._wnafT4;for(d=f;d>=0;d--){for(var A=0;d>=0;){var S=!0;for(g=0;g<n;g++)k[g]=0|c[g][d],0!==k[g]&&(S=!1);if(!S)break;A++,d--}if(d>=0&&A++,v=v.dblp(A),d<0)break;for(g=0;g<n;g++){var E,P=k[g];0!==P&&(P>0?E=u[g][P-1>>1]:P<0&&(E=u[g][-P-1>>1].neg()),v="affine"===E.type?v.mixedAdd(E):v.add(E))}}for(d=0;d<n;d++)u[d]=null;return i?v:v.toP()},u.BasePoint=c,c.prototype.eq=function(){throw new Error("Not implemented")},c.prototype.validate=function(){return this.curve.validate(this)},u.prototype.decodePoint=function(e,t){e=i.toArray(e,t);var r=this.p.byteLength();if((4===e[0]||6===e[0]||7===e[0])&&e.length-1==2*r)return 6===e[0]?o(e[e.length-1]%2==0):7===e[0]&&o(e[e.length-1]%2==1),this.point(e.slice(1,1+r),e.slice(1+r,1+2*r));if((2===e[0]||3===e[0])&&e.length-1===r)return this.pointFromX(e.slice(1,1+r),3===e[0]);throw new Error("Unknown point format")},c.prototype.encodeCompressed=function(e){return this.encode(e,!0)},c.prototype._encode=function(e){var t=this.curve.p.byteLength(),r=this.getX().toArray("be",t);return e?[this.getY().isEven()?2:3].concat(r):[4].concat(r,this.getY().toArray("be",t))},c.prototype.encode=function(e,t){return i.encode(this._encode(t),e)},c.prototype.precompute=function(e){if(this.precomputed)return this;var t={doubles:null,naf:null,beta:null};return t.naf=this._getNAFPoints(8),t.doubles=this._getDoubles(4,e),t.beta=this._getBeta(),this.precomputed=t,this},c.prototype._hasDoubles=function(e){if(!this.precomputed)return!1;var t=this.precomputed.doubles;return!!t&&t.points.length>=Math.ceil((e.bitLength()+1)/t.step)},c.prototype._getDoubles=function(e,t){if(this.precomputed&&this.precomputed.doubles)return this.precomputed.doubles;for(var r=[this],n=this,i=0;i<t;i+=e){for(var a=0;a<e;a++)n=n.dbl();r.push(n)}return{step:e,points:r}},c.prototype._getNAFPoints=function(e){if(this.precomputed&&this.precomputed.naf)return this.precomputed.naf;for(var t=[this],r=(1<<e)-1,n=1===r?null:this.dbl(),i=1;i<r;i++)t[i]=t[i-1].add(n);return{wnd:e,points:t}},c.prototype._getBeta=function(){return null},c.prototype.dblp=function(e){for(var t=this,r=0;r<e;r++)t=t.dbl();return t}},{"../../elliptic":19,"bn.js":17}],21:[function(e,t,r){"use strict";var n=e("../curve"),i=e("../../elliptic"),a=e("bn.js"),s=e("inherits"),o=n.base,u=i.utils.assert;function c(e){this.twisted=1!=(0|e.a),this.mOneA=this.twisted&&-1==(0|e.a),this.extended=this.mOneA,o.call(this,"edwards",e),this.a=new a(e.a,16).umod(this.red.m),this.a=this.a.toRed(this.red),this.c=new a(e.c,16).toRed(this.red),this.c2=this.c.redSqr(),this.d=new a(e.d,16).toRed(this.red),this.dd=this.d.redAdd(this.d),u(!this.twisted||0===this.c.fromRed().cmpn(1)),this.oneC=1==(0|e.c)}function f(e,t,r,n,i){o.BasePoint.call(this,e,"projective"),null===t&&null===r&&null===n?(this.x=this.curve.zero,this.y=this.curve.one,this.z=this.curve.one,this.t=this.curve.zero,this.zOne=!0):(this.x=new a(t,16),this.y=new a(r,16),this.z=n?new a(n,16):this.curve.one,this.t=i&&new a(i,16),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.z.red||(this.z=this.z.toRed(this.curve.red)),this.t&&!this.t.red&&(this.t=this.t.toRed(this.curve.red)),this.zOne=this.z===this.curve.one,this.curve.extended&&!this.t&&(this.t=this.x.redMul(this.y),this.zOne||(this.t=this.t.redMul(this.z.redInvm()))))}s(c,o),t.exports=c,c.prototype._mulA=function(e){return this.mOneA?e.redNeg():this.a.redMul(e)},c.prototype._mulC=function(e){return this.oneC?e:this.c.redMul(e)},c.prototype.jpoint=function(e,t,r,n){return this.point(e,t,r,n)},c.prototype.pointFromX=function(e,t){(e=new a(e,16)).red||(e=e.toRed(this.red));var r=e.redSqr(),n=this.c2.redSub(this.a.redMul(r)),i=this.one.redSub(this.c2.redMul(this.d).redMul(r)),s=n.redMul(i.redInvm()),o=s.redSqrt();if(0!==o.redSqr().redSub(s).cmp(this.zero))throw new Error("invalid point");var u=o.fromRed().isOdd();return(t&&!u||!t&&u)&&(o=o.redNeg()),this.point(e,o)},c.prototype.pointFromY=function(e,t){(e=new a(e,16)).red||(e=e.toRed(this.red));var r=e.redSqr(),n=r.redSub(this.c2),i=r.redMul(this.d).redMul(this.c2).redSub(this.a),s=n.redMul(i.redInvm());if(0===s.cmp(this.zero)){if(t)throw new Error("invalid point");return this.point(this.zero,e)}var o=s.redSqrt();if(0!==o.redSqr().redSub(s).cmp(this.zero))throw new Error("invalid point");return o.fromRed().isOdd()!==t&&(o=o.redNeg()),this.point(o,e)},c.prototype.validate=function(e){if(e.isInfinity())return!0;e.normalize();var t=e.x.redSqr(),r=e.y.redSqr(),n=t.redMul(this.a).redAdd(r),i=this.c2.redMul(this.one.redAdd(this.d.redMul(t).redMul(r)));return 0===n.cmp(i)},s(f,o.BasePoint),c.prototype.pointFromJSON=function(e){return f.fromJSON(this,e)},c.prototype.point=function(e,t,r,n){return new f(this,e,t,r,n)},f.fromJSON=function(e,t){return new f(e,t[0],t[1],t[2])},f.prototype.inspect=function(){return this.isInfinity()?"<EC Point Infinity>":"<EC Point x: "+this.x.fromRed().toString(16,2)+" y: "+this.y.fromRed().toString(16,2)+" z: "+this.z.fromRed().toString(16,2)+">"},f.prototype.isInfinity=function(){return 0===this.x.cmpn(0)&&(0===this.y.cmp(this.z)||this.zOne&&0===this.y.cmp(this.curve.c))},f.prototype._extDbl=function(){var e=this.x.redSqr(),t=this.y.redSqr(),r=this.z.redSqr();r=r.redIAdd(r);var n=this.curve._mulA(e),i=this.x.redAdd(this.y).redSqr().redISub(e).redISub(t),a=n.redAdd(t),s=a.redSub(r),o=n.redSub(t),u=i.redMul(s),c=a.redMul(o),f=i.redMul(o),d=s.redMul(a);return this.curve.point(u,c,d,f)},f.prototype._projDbl=function(){var e,t,r,n=this.x.redAdd(this.y).redSqr(),i=this.x.redSqr(),a=this.y.redSqr();if(this.curve.twisted){var s=(c=this.curve._mulA(i)).redAdd(a);if(this.zOne)e=n.redSub(i).redSub(a).redMul(s.redSub(this.curve.two)),t=s.redMul(c.redSub(a)),r=s.redSqr().redSub(s).redSub(s);else{var o=this.z.redSqr(),u=s.redSub(o).redISub(o);e=n.redSub(i).redISub(a).redMul(u),t=s.redMul(c.redSub(a)),r=s.redMul(u)}}else{var c=i.redAdd(a);o=this.curve._mulC(this.z).redSqr(),u=c.redSub(o).redSub(o);e=this.curve._mulC(n.redISub(c)).redMul(u),t=this.curve._mulC(c).redMul(i.redISub(a)),r=c.redMul(u)}return this.curve.point(e,t,r)},f.prototype.dbl=function(){return this.isInfinity()?this:this.curve.extended?this._extDbl():this._projDbl()},f.prototype._extAdd=function(e){var t=this.y.redSub(this.x).redMul(e.y.redSub(e.x)),r=this.y.redAdd(this.x).redMul(e.y.redAdd(e.x)),n=this.t.redMul(this.curve.dd).redMul(e.t),i=this.z.redMul(e.z.redAdd(e.z)),a=r.redSub(t),s=i.redSub(n),o=i.redAdd(n),u=r.redAdd(t),c=a.redMul(s),f=o.redMul(u),d=a.redMul(u),l=s.redMul(o);return this.curve.point(c,f,l,d)},f.prototype._projAdd=function(e){var t,r,n=this.z.redMul(e.z),i=n.redSqr(),a=this.x.redMul(e.x),s=this.y.redMul(e.y),o=this.curve.d.redMul(a).redMul(s),u=i.redSub(o),c=i.redAdd(o),f=this.x.redAdd(this.y).redMul(e.x.redAdd(e.y)).redISub(a).redISub(s),d=n.redMul(u).redMul(f);return this.curve.twisted?(t=n.redMul(c).redMul(s.redSub(this.curve._mulA(a))),r=u.redMul(c)):(t=n.redMul(c).redMul(s.redSub(a)),r=this.curve._mulC(u).redMul(c)),this.curve.point(d,t,r)},f.prototype.add=function(e){return this.isInfinity()?e:e.isInfinity()?this:this.curve.extended?this._extAdd(e):this._projAdd(e)},f.prototype.mul=function(e){return this._hasDoubles(e)?this.curve._fixedNafMul(this,e):this.curve._wnafMul(this,e)},f.prototype.mulAdd=function(e,t,r){return this.curve._wnafMulAdd(1,[this,t],[e,r],2,!1)},f.prototype.jmulAdd=function(e,t,r){return this.curve._wnafMulAdd(1,[this,t],[e,r],2,!0)},f.prototype.normalize=function(){if(this.zOne)return this;var e=this.z.redInvm();return this.x=this.x.redMul(e),this.y=this.y.redMul(e),this.t&&(this.t=this.t.redMul(e)),this.z=this.curve.one,this.zOne=!0,this},f.prototype.neg=function(){return this.curve.point(this.x.redNeg(),this.y,this.z,this.t&&this.t.redNeg())},f.prototype.getX=function(){return this.normalize(),this.x.fromRed()},f.prototype.getY=function(){return this.normalize(),this.y.fromRed()},f.prototype.eq=function(e){return this===e||0===this.getX().cmp(e.getX())&&0===this.getY().cmp(e.getY())},f.prototype.eqXToP=function(e){var t=e.toRed(this.curve.red).redMul(this.z);if(0===this.x.cmp(t))return!0;for(var r=e.clone(),n=this.curve.redN.redMul(this.z);;){if(r.iadd(this.curve.n),r.cmp(this.curve.p)>=0)return!1;if(t.redIAdd(n),0===this.x.cmp(t))return!0}},f.prototype.toP=f.prototype.normalize,f.prototype.mixedAdd=f.prototype.add},{"../../elliptic":19,"../curve":22,"bn.js":17,inherits:49}],22:[function(e,t,r){"use strict";var n=r;n.base=e("./base"),n.short=e("./short"),n.mont=e("./mont"),n.edwards=e("./edwards")},{"./base":20,"./edwards":21,"./mont":23,"./short":24}],23:[function(e,t,r){"use strict";var n=e("../curve"),i=e("bn.js"),a=e("inherits"),s=n.base,o=e("../../elliptic").utils;function u(e){s.call(this,"mont",e),this.a=new i(e.a,16).toRed(this.red),this.b=new i(e.b,16).toRed(this.red),this.i4=new i(4).toRed(this.red).redInvm(),this.two=new i(2).toRed(this.red),this.a24=this.i4.redMul(this.a.redAdd(this.two))}function c(e,t,r){s.BasePoint.call(this,e,"projective"),null===t&&null===r?(this.x=this.curve.one,this.z=this.curve.zero):(this.x=new i(t,16),this.z=new i(r,16),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.z.red||(this.z=this.z.toRed(this.curve.red)))}a(u,s),t.exports=u,u.prototype.validate=function(e){var t=e.normalize().x,r=t.redSqr(),n=r.redMul(t).redAdd(r.redMul(this.a)).redAdd(t);return 0===n.redSqrt().redSqr().cmp(n)},a(c,s.BasePoint),u.prototype.decodePoint=function(e,t){if(33===(e=o.toArray(e,t)).length&&64===e[0]&&(e=e.slice(1,33).reverse()),32!==e.length)throw new Error("Unknown point compression format");return this.point(e,1)},u.prototype.point=function(e,t){return new c(this,e,t)},u.prototype.pointFromJSON=function(e){return c.fromJSON(this,e)},c.prototype.precompute=function(){},c.prototype._encode=function(e){var t=this.curve.p.byteLength();return e?[64].concat(this.getX().toArray("le",t)):this.getX().toArray("be",t)},c.fromJSON=function(e,t){return new c(e,t[0],t[1]||e.one)},c.prototype.inspect=function(){return this.isInfinity()?"<EC Point Infinity>":"<EC Point x: "+this.x.fromRed().toString(16,2)+" z: "+this.z.fromRed().toString(16,2)+">"},c.prototype.isInfinity=function(){return 0===this.z.cmpn(0)},c.prototype.dbl=function(){var e=this.x.redAdd(this.z).redSqr(),t=this.x.redSub(this.z).redSqr(),r=e.redSub(t),n=e.redMul(t),i=r.redMul(t.redAdd(this.curve.a24.redMul(r)));return this.curve.point(n,i)},c.prototype.add=function(){throw new Error("Not supported on Montgomery curve")},c.prototype.diffAdd=function(e,t){var r=this.x.redAdd(this.z),n=this.x.redSub(this.z),i=e.x.redAdd(e.z),a=e.x.redSub(e.z).redMul(r),s=i.redMul(n),o=t.z.redMul(a.redAdd(s).redSqr()),u=t.x.redMul(a.redISub(s).redSqr());return this.curve.point(o,u)},c.prototype.mul=function(e){for(var t=(e=new i(e,16)).clone(),r=this,n=this.curve.point(null,null),a=[];0!==t.cmpn(0);t.iushrn(1))a.push(t.andln(1));for(var s=a.length-1;s>=0;s--)0===a[s]?(r=r.diffAdd(n,this),n=n.dbl()):(n=r.diffAdd(n,this),r=r.dbl());return n},c.prototype.mulAdd=function(){throw new Error("Not supported on Montgomery curve")},c.prototype.jumlAdd=function(){throw new Error("Not supported on Montgomery curve")},c.prototype.eq=function(e){return 0===this.getX().cmp(e.getX())},c.prototype.normalize=function(){return this.x=this.x.redMul(this.z.redInvm()),this.z=this.curve.one,this},c.prototype.getX=function(){return this.normalize(),this.x.fromRed()}},{"../../elliptic":19,"../curve":22,"bn.js":17,inherits:49}],24:[function(e,t,r){"use strict";var n=e("../curve"),i=e("../../elliptic"),a=e("bn.js"),s=e("inherits"),o=n.base,u=i.utils.assert;function c(e){o.call(this,"short",e),this.a=new a(e.a,16).toRed(this.red),this.b=new a(e.b,16).toRed(this.red),this.tinv=this.two.redInvm(),this.zeroA=0===this.a.fromRed().cmpn(0),this.threeA=0===this.a.fromRed().sub(this.p).cmpn(-3),this.endo=this._getEndomorphism(e),this._endoWnafT1=new Array(4),this._endoWnafT2=new Array(4)}function f(e,t,r,n){o.BasePoint.call(this,e,"affine"),null===t&&null===r?(this.x=null,this.y=null,this.inf=!0):(this.x=new a(t,16),this.y=new a(r,16),n&&(this.x.forceRed(this.curve.red),this.y.forceRed(this.curve.red)),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.inf=!1)}function d(e,t,r,n){o.BasePoint.call(this,e,"jacobian"),null===t&&null===r&&null===n?(this.x=this.curve.one,this.y=this.curve.one,this.z=new a(0)):(this.x=new a(t,16),this.y=new a(r,16),this.z=new a(n,16)),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.z.red||(this.z=this.z.toRed(this.curve.red)),this.zOne=this.z===this.curve.one}s(c,o),t.exports=c,c.prototype._getEndomorphism=function(e){if(this.zeroA&&this.g&&this.n&&1===this.p.modn(3)){var t,r;if(e.beta)t=new a(e.beta,16).toRed(this.red);else{var n=this._getEndoRoots(this.p);t=(t=n[0].cmp(n[1])<0?n[0]:n[1]).toRed(this.red)}if(e.lambda)r=new a(e.lambda,16);else{var i=this._getEndoRoots(this.n);0===this.g.mul(i[0]).x.cmp(this.g.x.redMul(t))?r=i[0]:(r=i[1],u(0===this.g.mul(r).x.cmp(this.g.x.redMul(t))))}return{beta:t,lambda:r,basis:e.basis?e.basis.map(function(e){return{a:new a(e.a,16),b:new a(e.b,16)}}):this._getEndoBasis(r)}}},c.prototype._getEndoRoots=function(e){var t=e===this.p?this.red:a.mont(e),r=new a(2).toRed(t).redInvm(),n=r.redNeg(),i=new a(3).toRed(t).redNeg().redSqrt().redMul(r);return[n.redAdd(i).fromRed(),n.redSub(i).fromRed()]},c.prototype._getEndoBasis=function(e){for(var t,r,n,i,s,o,u,c,f,d=this.n.ushrn(Math.floor(this.n.bitLength()/2)),l=e,h=this.n.clone(),p=new a(1),y=new a(0),b=new a(0),m=new a(1),g=0;0!==l.cmpn(0);){var w=h.div(l);c=h.sub(w.mul(l)),f=b.sub(w.mul(p));var _=m.sub(w.mul(y));if(!n&&c.cmp(d)<0)t=u.neg(),r=p,n=c.neg(),i=f;else if(n&&2==++g)break;u=c,h=l,l=c,b=p,p=f,m=y,y=_}s=c.neg(),o=f;var v=n.sqr().add(i.sqr());return s.sqr().add(o.sqr()).cmp(v)>=0&&(s=t,o=r),n.negative&&(n=n.neg(),i=i.neg()),s.negative&&(s=s.neg(),o=o.neg()),[{a:n,b:i},{a:s,b:o}]},c.prototype._endoSplit=function(e){var t=this.endo.basis,r=t[0],n=t[1],i=n.b.mul(e).divRound(this.n),a=r.b.neg().mul(e).divRound(this.n),s=i.mul(r.a),o=a.mul(n.a),u=i.mul(r.b),c=a.mul(n.b);return{k1:e.sub(s).sub(o),k2:u.add(c).neg()}},c.prototype.pointFromX=function(e,t){(e=new a(e,16)).red||(e=e.toRed(this.red));var r=e.redSqr().redMul(e).redIAdd(e.redMul(this.a)).redIAdd(this.b),n=r.redSqrt();if(0!==n.redSqr().redSub(r).cmp(this.zero))throw new Error("invalid point");var i=n.fromRed().isOdd();return(t&&!i||!t&&i)&&(n=n.redNeg()),this.point(e,n)},c.prototype.validate=function(e){if(e.inf)return!0;var t=e.x,r=e.y,n=this.a.redMul(t),i=t.redSqr().redMul(t).redIAdd(n).redIAdd(this.b);return 0===r.redSqr().redISub(i).cmpn(0)},c.prototype._endoWnafMulAdd=function(e,t,r){for(var n=this._endoWnafT1,i=this._endoWnafT2,a=0;a<e.length;a++){var s=this._endoSplit(t[a]),o=e[a],u=o._getBeta();s.k1.negative&&(s.k1.ineg(),o=o.neg(!0)),s.k2.negative&&(s.k2.ineg(),u=u.neg(!0)),n[2*a]=o,n[2*a+1]=u,i[2*a]=s.k1,i[2*a+1]=s.k2}for(var c=this._wnafMulAdd(1,n,i,2*a,r),f=0;f<2*a;f++)n[f]=null,i[f]=null;return c},s(f,o.BasePoint),c.prototype.point=function(e,t,r){return new f(this,e,t,r)},c.prototype.pointFromJSON=function(e,t){return f.fromJSON(this,e,t)},f.prototype._getBeta=function(){if(this.curve.endo){var e=this.precomputed;if(e&&e.beta)return e.beta;var t=this.curve.point(this.x.redMul(this.curve.endo.beta),this.y);if(e){var r=this.curve,n=function(e){return r.point(e.x.redMul(r.endo.beta),e.y)};e.beta=t,t.precomputed={beta:null,naf:e.naf&&{wnd:e.naf.wnd,points:e.naf.points.map(n)},doubles:e.doubles&&{step:e.doubles.step,points:e.doubles.points.map(n)}}}return t}},f.prototype.toJSON=function(){return this.precomputed?[this.x,this.y,this.precomputed&&{doubles:this.precomputed.doubles&&{step:this.precomputed.doubles.step,points:this.precomputed.doubles.points.slice(1)},naf:this.precomputed.naf&&{wnd:this.precomputed.naf.wnd,points:this.precomputed.naf.points.slice(1)}}]:[this.x,this.y]},f.fromJSON=function(e,t,r){"string"==typeof t&&(t=JSON.parse(t));var n=e.point(t[0],t[1],r);if(!t[2])return n;function i(t){return e.point(t[0],t[1],r)}var a=t[2];return n.precomputed={beta:null,doubles:a.doubles&&{step:a.doubles.step,points:[n].concat(a.doubles.points.map(i))},naf:a.naf&&{wnd:a.naf.wnd,points:[n].concat(a.naf.points.map(i))}},n},f.prototype.inspect=function(){return this.isInfinity()?"<EC Point Infinity>":"<EC Point x: "+this.x.fromRed().toString(16,2)+" y: "+this.y.fromRed().toString(16,2)+">"},f.prototype.isInfinity=function(){return this.inf},f.prototype.add=function(e){if(this.inf)return e;if(e.inf)return this;if(this.eq(e))return this.dbl();if(this.neg().eq(e))return this.curve.point(null,null);if(0===this.x.cmp(e.x))return this.curve.point(null,null);var t=this.y.redSub(e.y);0!==t.cmpn(0)&&(t=t.redMul(this.x.redSub(e.x).redInvm()));var r=t.redSqr().redISub(this.x).redISub(e.x),n=t.redMul(this.x.redSub(r)).redISub(this.y);return this.curve.point(r,n)},f.prototype.dbl=function(){if(this.inf)return this;var e=this.y.redAdd(this.y);if(0===e.cmpn(0))return this.curve.point(null,null);var t=this.curve.a,r=this.x.redSqr(),n=e.redInvm(),i=r.redAdd(r).redIAdd(r).redIAdd(t).redMul(n),a=i.redSqr().redISub(this.x.redAdd(this.x)),s=i.redMul(this.x.redSub(a)).redISub(this.y);return this.curve.point(a,s)},f.prototype.getX=function(){return this.x.fromRed()},f.prototype.getY=function(){return this.y.fromRed()},f.prototype.mul=function(e){return e=new a(e,16),this._hasDoubles(e)?this.curve._fixedNafMul(this,e):this.curve.endo?this.curve._endoWnafMulAdd([this],[e]):this.curve._wnafMul(this,e)},f.prototype.mulAdd=function(e,t,r){var n=[this,t],i=[e,r];return this.curve.endo?this.curve._endoWnafMulAdd(n,i):this.curve._wnafMulAdd(1,n,i,2)},f.prototype.jmulAdd=function(e,t,r){var n=[this,t],i=[e,r];return this.curve.endo?this.curve._endoWnafMulAdd(n,i,!0):this.curve._wnafMulAdd(1,n,i,2,!0)},f.prototype.eq=function(e){return this===e||this.inf===e.inf&&(this.inf||0===this.x.cmp(e.x)&&0===this.y.cmp(e.y))},f.prototype.neg=function(e){if(this.inf)return this;var t=this.curve.point(this.x,this.y.redNeg());if(e&&this.precomputed){var r=this.precomputed,n=function(e){return e.neg()};t.precomputed={naf:r.naf&&{wnd:r.naf.wnd,points:r.naf.points.map(n)},doubles:r.doubles&&{step:r.doubles.step,points:r.doubles.points.map(n)}}}return t},f.prototype.toJ=function(){return this.inf?this.curve.jpoint(null,null,null):this.curve.jpoint(this.x,this.y,this.curve.one)},s(d,o.BasePoint),c.prototype.jpoint=function(e,t,r){return new d(this,e,t,r)},d.prototype.toP=function(){if(this.isInfinity())return this.curve.point(null,null);var e=this.z.redInvm(),t=e.redSqr(),r=this.x.redMul(t),n=this.y.redMul(t).redMul(e);return this.curve.point(r,n)},d.prototype.neg=function(){return this.curve.jpoint(this.x,this.y.redNeg(),this.z)},d.prototype.add=function(e){if(this.isInfinity())return e;if(e.isInfinity())return this;var t=e.z.redSqr(),r=this.z.redSqr(),n=this.x.redMul(t),i=e.x.redMul(r),a=this.y.redMul(t.redMul(e.z)),s=e.y.redMul(r.redMul(this.z)),o=n.redSub(i),u=a.redSub(s);if(0===o.cmpn(0))return 0!==u.cmpn(0)?this.curve.jpoint(null,null,null):this.dbl();var c=o.redSqr(),f=c.redMul(o),d=n.redMul(c),l=u.redSqr().redIAdd(f).redISub(d).redISub(d),h=u.redMul(d.redISub(l)).redISub(a.redMul(f)),p=this.z.redMul(e.z).redMul(o);return this.curve.jpoint(l,h,p)},d.prototype.mixedAdd=function(e){if(this.isInfinity())return e.toJ();if(e.isInfinity())return this;var t=this.z.redSqr(),r=this.x,n=e.x.redMul(t),i=this.y,a=e.y.redMul(t).redMul(this.z),s=r.redSub(n),o=i.redSub(a);if(0===s.cmpn(0))return 0!==o.cmpn(0)?this.curve.jpoint(null,null,null):this.dbl();var u=s.redSqr(),c=u.redMul(s),f=r.redMul(u),d=o.redSqr().redIAdd(c).redISub(f).redISub(f),l=o.redMul(f.redISub(d)).redISub(i.redMul(c)),h=this.z.redMul(s);return this.curve.jpoint(d,l,h)},d.prototype.dblp=function(e){if(0===e)return this;if(this.isInfinity())return this;if(!e)return this.dbl();if(this.curve.zeroA||this.curve.threeA){for(var t=this,r=0;r<e;r++)t=t.dbl();return t}var n=this.curve.a,i=this.curve.tinv,a=this.x,s=this.y,o=this.z,u=o.redSqr().redSqr(),c=s.redAdd(s);for(r=0;r<e;r++){var f=a.redSqr(),d=c.redSqr(),l=d.redSqr(),h=f.redAdd(f).redIAdd(f).redIAdd(n.redMul(u)),p=a.redMul(d),y=h.redSqr().redISub(p.redAdd(p)),b=p.redISub(y),m=h.redMul(b);m=m.redIAdd(m).redISub(l);var g=c.redMul(o);r+1<e&&(u=u.redMul(l)),a=y,o=g,c=m}return this.curve.jpoint(a,c.redMul(i),o)},d.prototype.dbl=function(){return this.isInfinity()?this:this.curve.zeroA?this._zeroDbl():this.curve.threeA?this._threeDbl():this._dbl()},d.prototype._zeroDbl=function(){var e,t,r;if(this.zOne){var n=this.x.redSqr(),i=this.y.redSqr(),a=i.redSqr(),s=this.x.redAdd(i).redSqr().redISub(n).redISub(a);s=s.redIAdd(s);var o=n.redAdd(n).redIAdd(n),u=o.redSqr().redISub(s).redISub(s),c=a.redIAdd(a);c=(c=c.redIAdd(c)).redIAdd(c),e=u,t=o.redMul(s.redISub(u)).redISub(c),r=this.y.redAdd(this.y)}else{var f=this.x.redSqr(),d=this.y.redSqr(),l=d.redSqr(),h=this.x.redAdd(d).redSqr().redISub(f).redISub(l);h=h.redIAdd(h);var p=f.redAdd(f).redIAdd(f),y=p.redSqr(),b=l.redIAdd(l);b=(b=b.redIAdd(b)).redIAdd(b),e=y.redISub(h).redISub(h),t=p.redMul(h.redISub(e)).redISub(b),r=(r=this.y.redMul(this.z)).redIAdd(r)}return this.curve.jpoint(e,t,r)},d.prototype._threeDbl=function(){var e,t,r;if(this.zOne){var n=this.x.redSqr(),i=this.y.redSqr(),a=i.redSqr(),s=this.x.redAdd(i).redSqr().redISub(n).redISub(a);s=s.redIAdd(s);var o=n.redAdd(n).redIAdd(n).redIAdd(this.curve.a),u=o.redSqr().redISub(s).redISub(s);e=u;var c=a.redIAdd(a);c=(c=c.redIAdd(c)).redIAdd(c),t=o.redMul(s.redISub(u)).redISub(c),r=this.y.redAdd(this.y)}else{var f=this.z.redSqr(),d=this.y.redSqr(),l=this.x.redMul(d),h=this.x.redSub(f).redMul(this.x.redAdd(f));h=h.redAdd(h).redIAdd(h);var p=l.redIAdd(l),y=(p=p.redIAdd(p)).redAdd(p);e=h.redSqr().redISub(y),r=this.y.redAdd(this.z).redSqr().redISub(d).redISub(f);var b=d.redSqr();b=(b=(b=b.redIAdd(b)).redIAdd(b)).redIAdd(b),t=h.redMul(p.redISub(e)).redISub(b)}return this.curve.jpoint(e,t,r)},d.prototype._dbl=function(){var e=this.curve.a,t=this.x,r=this.y,n=this.z,i=n.redSqr().redSqr(),a=t.redSqr(),s=r.redSqr(),o=a.redAdd(a).redIAdd(a).redIAdd(e.redMul(i)),u=t.redAdd(t),c=(u=u.redIAdd(u)).redMul(s),f=o.redSqr().redISub(c.redAdd(c)),d=c.redISub(f),l=s.redSqr();l=(l=(l=l.redIAdd(l)).redIAdd(l)).redIAdd(l);var h=o.redMul(d).redISub(l),p=r.redAdd(r).redMul(n);return this.curve.jpoint(f,h,p)},d.prototype.trpl=function(){if(!this.curve.zeroA)return this.dbl().add(this);var e=this.x.redSqr(),t=this.y.redSqr(),r=this.z.redSqr(),n=t.redSqr(),i=e.redAdd(e).redIAdd(e),a=i.redSqr(),s=this.x.redAdd(t).redSqr().redISub(e).redISub(n),o=(s=(s=(s=s.redIAdd(s)).redAdd(s).redIAdd(s)).redISub(a)).redSqr(),u=n.redIAdd(n);u=(u=(u=u.redIAdd(u)).redIAdd(u)).redIAdd(u);var c=i.redIAdd(s).redSqr().redISub(a).redISub(o).redISub(u),f=t.redMul(c);f=(f=f.redIAdd(f)).redIAdd(f);var d=this.x.redMul(o).redISub(f);d=(d=d.redIAdd(d)).redIAdd(d);var l=this.y.redMul(c.redMul(u.redISub(c)).redISub(s.redMul(o)));l=(l=(l=l.redIAdd(l)).redIAdd(l)).redIAdd(l);var h=this.z.redAdd(s).redSqr().redISub(r).redISub(o);return this.curve.jpoint(d,l,h)},d.prototype.mul=function(e,t){return e=new a(e,t),this.curve._wnafMul(this,e)},d.prototype.eq=function(e){if("affine"===e.type)return this.eq(e.toJ());if(this===e)return!0;var t=this.z.redSqr(),r=e.z.redSqr();if(0!==this.x.redMul(r).redISub(e.x.redMul(t)).cmpn(0))return!1;var n=t.redMul(this.z),i=r.redMul(e.z);return 0===this.y.redMul(i).redISub(e.y.redMul(n)).cmpn(0)},d.prototype.eqXToP=function(e){var t=this.z.redSqr(),r=e.toRed(this.curve.red).redMul(t);if(0===this.x.cmp(r))return!0;for(var n=e.clone(),i=this.curve.redN.redMul(t);;){if(n.iadd(this.curve.n),n.cmp(this.curve.p)>=0)return!1;if(r.redIAdd(i),0===this.x.cmp(r))return!0}},d.prototype.inspect=function(){return this.isInfinity()?"<EC JPoint Infinity>":"<EC JPoint x: "+this.x.toString(16,2)+" y: "+this.y.toString(16,2)+" z: "+this.z.toString(16,2)+">"},d.prototype.isInfinity=function(){return 0===this.z.cmpn(0)}},{"../../elliptic":19,"../curve":22,"bn.js":17,inherits:49}],25:[function(e,t,r){"use strict";var n,i=r,a=e("hash.js"),s=e("../elliptic"),o=s.utils.assert;function u(e){if("short"===e.type)this.curve=new s.curve.short(e);else if("edwards"===e.type)this.curve=new s.curve.edwards(e);else{if("mont"!==e.type)throw new Error("Unknown curve type.");this.curve=new s.curve.mont(e)}this.g=this.curve.g,this.n=this.curve.n,this.hash=e.hash,o(this.g.validate(),"Invalid curve"),o(this.g.mul(this.n).isInfinity(),"Invalid curve, n*G != O")}function c(e,t){Object.defineProperty(i,e,{configurable:!0,enumerable:!0,get:function(){var r=new u(t);return Object.defineProperty(i,e,{configurable:!0,enumerable:!0,value:r}),r}})}i.PresetCurve=u,c("p192",{type:"short",prime:"p192",p:"ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff",a:"ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc",b:"64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1",n:"ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831",hash:a.sha256,gRed:!1,g:["188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012","07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811"]}),c("p224",{type:"short",prime:"p224",p:"ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001",a:"ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe",b:"b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4",n:"ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d",hash:a.sha256,gRed:!1,g:["b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21","bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34"]}),c("p256",{type:"short",prime:null,p:"ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff",a:"ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc",b:"5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b",n:"ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551",hash:a.sha256,gRed:!1,g:["6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296","4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5"]}),c("p384",{type:"short",prime:null,p:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 ffffffff",a:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 fffffffc",b:"b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f 5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef",n:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 f4372ddf 581a0db2 48b0a77a ecec196a ccc52973",hash:a.sha384,gRed:!1,g:["aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 5502f25d bf55296c 3a545e38 72760ab7","3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 0a60b1ce 1d7e819d 7a431d7c 90ea0e5f"]}),c("p521",{type:"short",prime:null,p:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff",a:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffc",b:"00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b 99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd 3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00",n:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409",hash:a.sha512,gRed:!1,g:["000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66","00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 3fad0761 353c7086 a272c240 88be9476 9fd16650"]}),c("curve25519",{type:"mont",prime:"p25519",p:"7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",a:"76d06",b:"1",n:"1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",cofactor:"8",hash:a.sha256,gRed:!1,g:["9"]}),c("ed25519",{type:"edwards",prime:"p25519",p:"7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",a:"-1",c:"1",d:"52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3",n:"1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",cofactor:"8",hash:a.sha256,gRed:!1,g:["216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a","6666666666666666666666666666666666666666666666666666666666666658"]}),c("brainpoolP256r1",{type:"short",prime:null,p:"A9FB57DB A1EEA9BC 3E660A90 9D838D72 6E3BF623 D5262028 2013481D 1F6E5377",a:"7D5A0975 FC2C3057 EEF67530 417AFFE7 FB8055C1 26DC5C6C E94A4B44 F330B5D9",b:"26DC5C6C E94A4B44 F330B5D9 BBD77CBF 95841629 5CF7E1CE 6BCCDC18 FF8C07B6",n:"A9FB57DB A1EEA9BC 3E660A90 9D838D71 8C397AA3 B561A6F7 901E0E82 974856A7",hash:a.sha256,gRed:!1,g:["8BD2AEB9CB7E57CB2C4B482FFC81B7AFB9DE27E1E3BD23C23A4453BD9ACE3262","547EF835C3DAC4FD97F8461A14611DC9C27745132DED8E545C1D54C72F046997"]}),c("brainpoolP384r1",{type:"short",prime:null,p:"8CB91E82 A3386D28 0F5D6F7E 50E641DF 152F7109 ED5456B4 12B1DA19 7FB71123ACD3A729 901D1A71 87470013 3107EC53",a:"7BC382C6 3D8C150C 3C72080A CE05AFA0 C2BEA28E 4FB22787 139165EF BA91F90F8AA5814A 503AD4EB 04A8C7DD 22CE2826",b:"04A8C7DD 22CE2826 8B39B554 16F0447C 2FB77DE1 07DCD2A6 2E880EA5 3EEB62D57CB43902 95DBC994 3AB78696 FA504C11",n:"8CB91E82 A3386D28 0F5D6F7E 50E641DF 152F7109 ED5456B3 1F166E6C AC0425A7CF3AB6AF 6B7FC310 3B883202 E9046565",hash:a.sha384,gRed:!1,g:["1D1C64F068CF45FFA2A63A81B7C13F6B8847A3E77EF14FE3DB7FCAFE0CBD10E8E826E03436D646AAEF87B2E247D4AF1E","8ABE1D7520F9C2A45CB1EB8E95CFD55262B70B29FEEC5864E19C054FF99129280E4646217791811142820341263C5315"]}),c("brainpoolP512r1",{type:"short",prime:null,p:"AADD9DB8 DBE9C48B 3FD4E6AE 33C9FC07 CB308DB3 B3C9D20E D6639CCA 703308717D4D9B00 9BC66842 AECDA12A E6A380E6 2881FF2F 2D82C685 28AA6056 583A48F3",a:"7830A331 8B603B89 E2327145 AC234CC5 94CBDD8D 3DF91610 A83441CA EA9863BC2DED5D5A A8253AA1 0A2EF1C9 8B9AC8B5 7F1117A7 2BF2C7B9 E7C1AC4D 77FC94CA",b:"3DF91610 A83441CA EA9863BC 2DED5D5A A8253AA1 0A2EF1C9 8B9AC8B5 7F1117A72BF2C7B9 E7C1AC4D 77FC94CA DC083E67 984050B7 5EBAE5DD 2809BD63 8016F723",n:"AADD9DB8 DBE9C48B 3FD4E6AE 33C9FC07 CB308DB3 B3C9D20E D6639CCA 70330870553E5C41 4CA92619 41866119 7FAC1047 1DB1D381 085DDADD B5879682 9CA90069",hash:a.sha512,gRed:!1,g:["81AEE4BDD82ED9645A21322E9C4C6A9385ED9F70B5D916C1B43B62EEF4D0098EFF3B1F78E2D0D48D50D1687B93B97D5F7C6D5047406A5E688B352209BCB9F822","7DDE385D566332ECC0EABFA9CF7822FDF209F70024A57B1AA000C55B881F8111B2DCDE494A5F485E5BCA4BD88A2763AED1CA2B2FA8F0540678CD1E0F3AD80892"]});try{n=e("./precomputed/secp256k1")}catch(f){n=void 0}c("secp256k1",{type:"short",prime:"k256",p:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f",a:"0",b:"7",n:"ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141",h:"1",hash:a.sha256,beta:"7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",lambda:"5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72",basis:[{a:"3086d221a7d46bcde86c90e49284eb15",b:"-e4437ed6010e88286f547fa90abfe4c3"},{a:"114ca50f7a8e2f3f657c1108d9d44cfd8",b:"3086d221a7d46bcde86c90e49284eb15"}],gRed:!1,g:["79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798","483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",n]})},{"../elliptic":19,"./precomputed/secp256k1":32,"hash.js":36}],26:[function(e,t,r){"use strict";var n=e("bn.js"),i=e("hmac-drbg"),a=e("../../elliptic"),s=a.utils.assert,o=e("./key"),u=e("./signature");function c(e){if(!(this instanceof c))return new c(e);"string"==typeof e&&(s(a.curves.hasOwnProperty(e),"Unknown curve "+e),e=a.curves[e]),e instanceof a.curves.PresetCurve&&(e={curve:e}),this.curve=e.curve.curve,this.n=this.curve.n,this.nh=this.n.ushrn(1),this.g=this.curve.g,this.g=e.curve.g,this.g.precompute(e.curve.n.bitLength()+1),this.hash=e.hash||e.curve.hash}t.exports=c,c.prototype.keyPair=function(e){return new o(this,e)},c.prototype.keyFromPrivate=function(e,t){return o.fromPrivate(this,e,t)},c.prototype.keyFromPublic=function(e,t){return o.fromPublic(this,e,t)},c.prototype.genKeyPair=function(e){e||(e={});var t=new i({hash:this.hash,pers:e.pers,persEnc:e.persEnc||"utf8",entropy:e.entropy||a.rand(this.hash.hmacStrength),entropyEnc:e.entropy&&e.entropyEnc||"utf8",nonce:this.n.toArray()});if("mont"===this.curve.type){var r=new n(t.generate(32));return this.keyFromPrivate(r)}for(var s=this.n.byteLength(),o=this.n.sub(new n(2));;){if(!((r=new n(t.generate(s))).cmp(o)>0))return r.iaddn(1),this.keyFromPrivate(r)}},c.prototype._truncateToN=function(e,t){var r=8*e.byteLength()-this.n.bitLength();return r>0&&(e=e.ushrn(r)),!t&&e.cmp(this.n)>=0?e.sub(this.n):e},c.prototype.sign=function(e,t,r,a){"object"==typeof r&&(a=r,r=null),a||(a={}),t=this.keyFromPrivate(t,r),e=this._truncateToN(new n(e,16));for(var s=this.n.byteLength(),o=t.getPrivate().toArray("be",s),c=e.toArray("be",s),f=new i({hash:this.hash,entropy:o,nonce:c,pers:a.pers,persEnc:a.persEnc||"utf8"}),d=this.n.sub(new n(1)),l=0;;l++){var h=a.k?a.k(l):new n(f.generate(this.n.byteLength()));if(!((h=this._truncateToN(h,!0)).cmpn(1)<=0||h.cmp(d)>=0)){var p=this.g.mul(h);if(!p.isInfinity()){var y=p.getX(),b=y.umod(this.n);if(0!==b.cmpn(0)){var m=h.invm(this.n).mul(b.mul(t.getPrivate()).iadd(e));if(0!==(m=m.umod(this.n)).cmpn(0)){var g=(p.getY().isOdd()?1:0)|(0!==y.cmp(b)?2:0);return a.canonical&&m.cmp(this.nh)>0&&(m=this.n.sub(m),g^=1),new u({r:b,s:m,recoveryParam:g})}}}}}},c.prototype.verify=function(e,t,r,i){e=this._truncateToN(new n(e,16)),r=this.keyFromPublic(r,i);var a=(t=new u(t,"hex")).r,s=t.s;if(a.cmpn(1)<0||a.cmp(this.n)>=0)return!1;if(s.cmpn(1)<0||s.cmp(this.n)>=0)return!1;var o,c=s.invm(this.n),f=c.mul(e).umod(this.n),d=c.mul(a).umod(this.n);return this.curve._maxwellTrick?!(o=this.g.jmulAdd(f,r.getPublic(),d)).isInfinity()&&o.eqXToP(a):!(o=this.g.mulAdd(f,r.getPublic(),d)).isInfinity()&&0===o.getX().umod(this.n).cmp(a)},c.prototype.recoverPubKey=function(e,t,r,i){s((3&r)===r,"The recovery param is more than two bits"),t=new u(t,i);var a=this.n,o=new n(e),c=t.r,f=t.s,d=1&r,l=r>>1;if(c.cmp(this.curve.p.umod(this.curve.n))>=0&&l)throw new Error("Unable to find sencond key candinate");c=l?this.curve.pointFromX(c.add(this.curve.n),d):this.curve.pointFromX(c,d);var h=t.r.invm(a),p=a.sub(o).mul(h).umod(a),y=f.mul(h).umod(a);return this.g.mulAdd(p,c,y)},c.prototype.getKeyRecoveryParam=function(e,t,r,n){if(null!==(t=new u(t,n)).recoveryParam)return t.recoveryParam;for(var i=0;i<4;i++){var a;try{a=this.recoverPubKey(e,t,i)}catch(e){continue}if(a.eq(r))return i}throw new Error("Unable to find valid recovery factor")}},{"../../elliptic":19,"./key":27,"./signature":28,"bn.js":17,"hmac-drbg":48}],27:[function(e,t,r){"use strict";var n=e("bn.js"),i=e("../../elliptic").utils.assert;function a(e,t){this.ec=e,this.priv=null,this.pub=null,t.priv&&this._importPrivate(t.priv,t.privEnc),t.pub&&this._importPublic(t.pub,t.pubEnc)}t.exports=a,a.fromPublic=function(e,t,r){return t instanceof a?t:new a(e,{pub:t,pubEnc:r})},a.fromPrivate=function(e,t,r){return t instanceof a?t:new a(e,{priv:t,privEnc:r})},a.prototype.validate=function(){var e=this.getPublic();return e.isInfinity()?{result:!1,reason:"Invalid public key"}:e.validate()?e.mul(this.ec.curve.n).isInfinity()?{result:!0,reason:null}:{result:!1,reason:"Public key * N != O"}:{result:!1,reason:"Public key is not a point"}},a.prototype.getPublic=function(e,t){return this.pub||(this.pub=this.ec.g.mul(this.priv)),e?this.pub.encode(e,t):this.pub},a.prototype.getPrivate=function(e){return"hex"===e?this.priv.toString(16,2):this.priv},a.prototype._importPrivate=function(e,t){if(this.priv=new n(e,t||16),"mont"===this.ec.curve.type){var r=this.ec.curve.one,i=r.ushln(252).sub(r).ushln(3);this.priv=this.priv.or(r.ushln(254)),this.priv=this.priv.and(i)}else this.priv=this.priv.umod(this.ec.curve.n)},a.prototype._importPublic=function(e,t){if(e.x||e.y)return"mont"===this.ec.curve.type?i(e.x,"Need x coordinate"):"short"!==this.ec.curve.type&&"edwards"!==this.ec.curve.type||i(e.x&&e.y,"Need both x and y coordinate"),void(this.pub=this.ec.curve.point(e.x,e.y));this.pub=this.ec.curve.decodePoint(e,t)},a.prototype.derive=function(e){return e.mul(this.priv).getX()},a.prototype.sign=function(e,t,r){return this.ec.sign(e,this,t,r)},a.prototype.verify=function(e,t){return this.ec.verify(e,t,this)},a.prototype.inspect=function(){return"<Key priv: "+(this.priv&&this.priv.toString(16,2))+" pub: "+(this.pub&&this.pub.inspect())+" >"}},{"../../elliptic":19,"bn.js":17}],28:[function(e,t,r){"use strict";var n=e("bn.js"),i=e("../../elliptic").utils,a=i.assert;function s(e,t){if(e instanceof s)return e;this._importDER(e,t)||(a(e.r&&e.s,"Signature without r or s"),this.r=new n(e.r,16),this.s=new n(e.s,16),void 0===e.recoveryParam?this.recoveryParam=null:this.recoveryParam=e.recoveryParam)}function o(){this.place=0}function u(e,t){var r=e[t.place++];if(!(128&r))return r;for(var n=15&r,i=0,a=0,s=t.place;a<n;a++,s++)i<<=8,i|=e[s];return t.place=s,i}function c(e){for(var t=0,r=e.length-1;!e[t]&&!(128&e[t+1])&&t<r;)t++;return 0===t?e:e.slice(t)}function f(e,t){if(t<128)e.push(t);else{var r=1+(Math.log(t)/Math.LN2>>>3);for(e.push(128|r);--r;)e.push(t>>>(r<<3)&255);e.push(t)}}t.exports=s,s.prototype._importDER=function(e,t){e=i.toArray(e,t);var r=new o;if(48!==e[r.place++])return!1;if(u(e,r)+r.place!==e.length)return!1;if(2!==e[r.place++])return!1;var a=u(e,r),s=e.slice(r.place,a+r.place);if(r.place+=a,2!==e[r.place++])return!1;var c=u(e,r);if(e.length!==c+r.place)return!1;var f=e.slice(r.place,c+r.place);return 0===s[0]&&128&s[1]&&(s=s.slice(1)),0===f[0]&&128&f[1]&&(f=f.slice(1)),this.r=new n(s),this.s=new n(f),this.recoveryParam=null,!0},s.prototype.toDER=function(e){var t=this.r.toArray(),r=this.s.toArray();for(128&t[0]&&(t=[0].concat(t)),128&r[0]&&(r=[0].concat(r)),t=c(t),r=c(r);!(r[0]||128&r[1]);)r=r.slice(1);var n=[2];f(n,t.length),(n=n.concat(t)).push(2),f(n,r.length);var a=n.concat(r),s=[48];return f(s,a.length),s=s.concat(a),i.encode(s,e)}},{"../../elliptic":19,"bn.js":17}],29:[function(e,t,r){"use strict";var n=e("hash.js"),i=e("hmac-drbg"),a=e("../../elliptic"),s=a.utils,o=s.assert,u=s.parseBytes,c=e("./key"),f=e("./signature");function d(e){if(o("ed25519"===e,"only tested with ed25519 so far"),!(this instanceof d))return new d(e);e=a.curves[e].curve;this.curve=e,this.g=e.g,this.g.precompute(e.n.bitLength()+1),this.pointClass=e.point().constructor,this.encodingLength=Math.ceil(e.n.bitLength()/8),this.hash=n.sha512}t.exports=d,d.prototype.sign=function(e,t){e=u(e);var r=this.keyFromSecret(t),n=this.hashInt(r.messagePrefix(),e),i=this.g.mul(n),a=this.encodePoint(i),s=this.hashInt(a,r.pubBytes(),e).mul(r.priv()),o=n.add(s).umod(this.curve.n);return this.makeSignature({R:i,S:o,Rencoded:a})},d.prototype.verify=function(e,t,r){e=u(e),t=this.makeSignature(t);var n=this.keyFromPublic(r),i=this.hashInt(t.Rencoded(),n.pubBytes(),e),a=this.g.mul(t.S());return t.R().add(n.pub().mul(i)).eq(a)},d.prototype.hashInt=function(){for(var e=this.hash(),t=0;t<arguments.length;t++)e.update(arguments[t]);return s.intFromLE(e.digest()).umod(this.curve.n)},d.prototype.keyPair=function(e){return new c(this,e)},d.prototype.keyFromPublic=function(e){return c.fromPublic(this,e)},d.prototype.keyFromSecret=function(e){return c.fromSecret(this,e)},d.prototype.genKeyPair=function(e){e||(e={});var t=new i({hash:this.hash,pers:e.pers,persEnc:e.persEnc||"utf8",entropy:e.entropy||a.rand(this.hash.hmacStrength),entropyEnc:e.entropy&&e.entropyEnc||"utf8",nonce:this.curve.n.toArray()});return this.keyFromSecret(t.generate(32))},d.prototype.makeSignature=function(e){return e instanceof f?e:new f(this,e)},d.prototype.encodePoint=function(e){var t=e.getY().toArray("le",this.encodingLength);return t[this.encodingLength-1]|=e.getX().isOdd()?128:0,t},d.prototype.decodePoint=function(e){var t=(e=s.parseBytes(e)).length-1,r=e.slice(0,t).concat(-129&e[t]),n=0!=(128&e[t]),i=s.intFromLE(r);return this.curve.pointFromY(i,n)},d.prototype.encodeInt=function(e){return e.toArray("le",this.encodingLength)},d.prototype.decodeInt=function(e){return s.intFromLE(e)},d.prototype.isPoint=function(e){return e instanceof this.pointClass}},{"../../elliptic":19,"./key":30,"./signature":31,"hash.js":36,"hmac-drbg":48}],30:[function(e,t,r){"use strict";var n=e("../../elliptic").utils,i=n.assert,a=n.parseBytes,s=n.cachedProperty;function o(e,t){if(this.eddsa=e,t.hasOwnProperty("secret")&&(this._secret=a(t.secret)),e.isPoint(t.pub))this._pub=t.pub;else if(this._pubBytes=a(t.pub),this._pubBytes&&33===this._pubBytes.length&&64===this._pubBytes[0]&&(this._pubBytes=this._pubBytes.slice(1,33)),this._pubBytes&&32!==this._pubBytes.length)throw new Error("Unknown point compression format")}o.fromPublic=function(e,t){return t instanceof o?t:new o(e,{pub:t})},o.fromSecret=function(e,t){return t instanceof o?t:new o(e,{secret:t})},o.prototype.secret=function(){return this._secret},s(o,"pubBytes",function(){return this.eddsa.encodePoint(this.pub())}),s(o,"pub",function(){return this._pubBytes?this.eddsa.decodePoint(this._pubBytes):this.eddsa.g.mul(this.priv())}),s(o,"privBytes",function(){var e=this.eddsa,t=this.hash(),r=e.encodingLength-1,n=t.slice(0,e.encodingLength);return n[0]&=248,n[r]&=127,n[r]|=64,n}),s(o,"priv",function(){return this.eddsa.decodeInt(this.privBytes())}),s(o,"hash",function(){return this.eddsa.hash().update(this.secret()).digest()}),s(o,"messagePrefix",function(){return this.hash().slice(this.eddsa.encodingLength)}),o.prototype.sign=function(e){return i(this._secret,"KeyPair can only verify"),this.eddsa.sign(e,this)},o.prototype.verify=function(e,t){return this.eddsa.verify(e,t,this)},o.prototype.getSecret=function(e){return i(this._secret,"KeyPair is public only"),n.encode(this.secret(),e)},o.prototype.getPublic=function(e,t){return n.encode((t?[64]:[]).concat(this.pubBytes()),e)},t.exports=o},{"../../elliptic":19}],31:[function(e,t,r){"use strict";var n=e("bn.js"),i=e("../../elliptic").utils,a=i.assert,s=i.cachedProperty,o=i.parseBytes;function u(e,t){this.eddsa=e,"object"!=typeof t&&(t=o(t)),Array.isArray(t)&&(t={R:t.slice(0,e.encodingLength),S:t.slice(e.encodingLength)}),a(t.R&&t.S,"Signature without R or S"),e.isPoint(t.R)&&(this._R=t.R),t.S instanceof n&&(this._S=t.S),this._Rencoded=Array.isArray(t.R)?t.R:t.Rencoded,this._Sencoded=Array.isArray(t.S)?t.S:t.Sencoded}s(u,"S",function(){return this.eddsa.decodeInt(this.Sencoded())}),s(u,"R",function(){return this.eddsa.decodePoint(this.Rencoded())}),s(u,"Rencoded",function(){return this.eddsa.encodePoint(this.R())}),s(u,"Sencoded",function(){return this.eddsa.encodeInt(this.S())}),u.prototype.toBytes=function(){return this.Rencoded().concat(this.Sencoded())},u.prototype.toHex=function(){return i.encode(this.toBytes(),"hex").toUpperCase()},t.exports=u},{"../../elliptic":19,"bn.js":17}],32:[function(e,t,r){t.exports={doubles:{step:4,points:[["e60fce93b59e9ec53011aabc21c23e97b2a31369b87a5ae9c44ee89e2a6dec0a","f7e3507399e595929db99f34f57937101296891e44d23f0be1f32cce69616821"],["8282263212c609d9ea2a6e3e172de238d8c39cabd5ac1ca10646e23fd5f51508","11f8a8098557dfe45e8256e830b60ace62d613ac2f7b17bed31b6eaff6e26caf"],["175e159f728b865a72f99cc6c6fc846de0b93833fd2222ed73fce5b551e5b739","d3506e0d9e3c79eba4ef97a51ff71f5eacb5955add24345c6efa6ffee9fed695"],["363d90d447b00c9c99ceac05b6262ee053441c7e55552ffe526bad8f83ff4640","4e273adfc732221953b445397f3363145b9a89008199ecb62003c7f3bee9de9"],["8b4b5f165df3c2be8c6244b5b745638843e4a781a15bcd1b69f79a55dffdf80c","4aad0a6f68d308b4b3fbd7813ab0da04f9e336546162ee56b3eff0c65fd4fd36"],["723cbaa6e5db996d6bf771c00bd548c7b700dbffa6c0e77bcb6115925232fcda","96e867b5595cc498a921137488824d6e2660a0653779494801dc069d9eb39f5f"],["eebfa4d493bebf98ba5feec812c2d3b50947961237a919839a533eca0e7dd7fa","5d9a8ca3970ef0f269ee7edaf178089d9ae4cdc3a711f712ddfd4fdae1de8999"],["100f44da696e71672791d0a09b7bde459f1215a29b3c03bfefd7835b39a48db0","cdd9e13192a00b772ec8f3300c090666b7ff4a18ff5195ac0fbd5cd62bc65a09"],["e1031be262c7ed1b1dc9227a4a04c017a77f8d4464f3b3852c8acde6e534fd2d","9d7061928940405e6bb6a4176597535af292dd419e1ced79a44f18f29456a00d"],["feea6cae46d55b530ac2839f143bd7ec5cf8b266a41d6af52d5e688d9094696d","e57c6b6c97dce1bab06e4e12bf3ecd5c981c8957cc41442d3155debf18090088"],["da67a91d91049cdcb367be4be6ffca3cfeed657d808583de33fa978bc1ec6cb1","9bacaa35481642bc41f463f7ec9780e5dec7adc508f740a17e9ea8e27a68be1d"],["53904faa0b334cdda6e000935ef22151ec08d0f7bb11069f57545ccc1a37b7c0","5bc087d0bc80106d88c9eccac20d3c1c13999981e14434699dcb096b022771c8"],["8e7bcd0bd35983a7719cca7764ca906779b53a043a9b8bcaeff959f43ad86047","10b7770b2a3da4b3940310420ca9514579e88e2e47fd68b3ea10047e8460372a"],["385eed34c1cdff21e6d0818689b81bde71a7f4f18397e6690a841e1599c43862","283bebc3e8ea23f56701de19e9ebf4576b304eec2086dc8cc0458fe5542e5453"],["6f9d9b803ecf191637c73a4413dfa180fddf84a5947fbc9c606ed86c3fac3a7","7c80c68e603059ba69b8e2a30e45c4d47ea4dd2f5c281002d86890603a842160"],["3322d401243c4e2582a2147c104d6ecbf774d163db0f5e5313b7e0e742d0e6bd","56e70797e9664ef5bfb019bc4ddaf9b72805f63ea2873af624f3a2e96c28b2a0"],["85672c7d2de0b7da2bd1770d89665868741b3f9af7643397721d74d28134ab83","7c481b9b5b43b2eb6374049bfa62c2e5e77f17fcc5298f44c8e3094f790313a6"],["948bf809b1988a46b06c9f1919413b10f9226c60f668832ffd959af60c82a0a","53a562856dcb6646dc6b74c5d1c3418c6d4dff08c97cd2bed4cb7f88d8c8e589"],["6260ce7f461801c34f067ce0f02873a8f1b0e44dfc69752accecd819f38fd8e8","bc2da82b6fa5b571a7f09049776a1ef7ecd292238051c198c1a84e95b2b4ae17"],["e5037de0afc1d8d43d8348414bbf4103043ec8f575bfdc432953cc8d2037fa2d","4571534baa94d3b5f9f98d09fb990bddbd5f5b03ec481f10e0e5dc841d755bda"],["e06372b0f4a207adf5ea905e8f1771b4e7e8dbd1c6a6c5b725866a0ae4fce725","7a908974bce18cfe12a27bb2ad5a488cd7484a7787104870b27034f94eee31dd"],["213c7a715cd5d45358d0bbf9dc0ce02204b10bdde2a3f58540ad6908d0559754","4b6dad0b5ae462507013ad06245ba190bb4850f5f36a7eeddff2c27534b458f2"],["4e7c272a7af4b34e8dbb9352a5419a87e2838c70adc62cddf0cc3a3b08fbd53c","17749c766c9d0b18e16fd09f6def681b530b9614bff7dd33e0b3941817dcaae6"],["fea74e3dbe778b1b10f238ad61686aa5c76e3db2be43057632427e2840fb27b6","6e0568db9b0b13297cf674deccb6af93126b596b973f7b77701d3db7f23cb96f"],["76e64113f677cf0e10a2570d599968d31544e179b760432952c02a4417bdde39","c90ddf8dee4e95cf577066d70681f0d35e2a33d2b56d2032b4b1752d1901ac01"],["c738c56b03b2abe1e8281baa743f8f9a8f7cc643df26cbee3ab150242bcbb891","893fb578951ad2537f718f2eacbfbbbb82314eef7880cfe917e735d9699a84c3"],["d895626548b65b81e264c7637c972877d1d72e5f3a925014372e9f6588f6c14b","febfaa38f2bc7eae728ec60818c340eb03428d632bb067e179363ed75d7d991f"],["b8da94032a957518eb0f6433571e8761ceffc73693e84edd49150a564f676e03","2804dfa44805a1e4d7c99cc9762808b092cc584d95ff3b511488e4e74efdf6e7"],["e80fea14441fb33a7d8adab9475d7fab2019effb5156a792f1a11778e3c0df5d","eed1de7f638e00771e89768ca3ca94472d155e80af322ea9fcb4291b6ac9ec78"],["a301697bdfcd704313ba48e51d567543f2a182031efd6915ddc07bbcc4e16070","7370f91cfb67e4f5081809fa25d40f9b1735dbf7c0a11a130c0d1a041e177ea1"],["90ad85b389d6b936463f9d0512678de208cc330b11307fffab7ac63e3fb04ed4","e507a3620a38261affdcbd9427222b839aefabe1582894d991d4d48cb6ef150"],["8f68b9d2f63b5f339239c1ad981f162ee88c5678723ea3351b7b444c9ec4c0da","662a9f2dba063986de1d90c2b6be215dbbea2cfe95510bfdf23cbf79501fff82"],["e4f3fb0176af85d65ff99ff9198c36091f48e86503681e3e6686fd5053231e11","1e63633ad0ef4f1c1661a6d0ea02b7286cc7e74ec951d1c9822c38576feb73bc"],["8c00fa9b18ebf331eb961537a45a4266c7034f2f0d4e1d0716fb6eae20eae29e","efa47267fea521a1a9dc343a3736c974c2fadafa81e36c54e7d2a4c66702414b"],["e7a26ce69dd4829f3e10cec0a9e98ed3143d084f308b92c0997fddfc60cb3e41","2a758e300fa7984b471b006a1aafbb18d0a6b2c0420e83e20e8a9421cf2cfd51"],["b6459e0ee3662ec8d23540c223bcbdc571cbcb967d79424f3cf29eb3de6b80ef","67c876d06f3e06de1dadf16e5661db3c4b3ae6d48e35b2ff30bf0b61a71ba45"],["d68a80c8280bb840793234aa118f06231d6f1fc67e73c5a5deda0f5b496943e8","db8ba9fff4b586d00c4b1f9177b0e28b5b0e7b8f7845295a294c84266b133120"],["324aed7df65c804252dc0270907a30b09612aeb973449cea4095980fc28d3d5d","648a365774b61f2ff130c0c35aec1f4f19213b0c7e332843967224af96ab7c84"],["4df9c14919cde61f6d51dfdbe5fee5dceec4143ba8d1ca888e8bd373fd054c96","35ec51092d8728050974c23a1d85d4b5d506cdc288490192ebac06cad10d5d"],["9c3919a84a474870faed8a9c1cc66021523489054d7f0308cbfc99c8ac1f98cd","ddb84f0f4a4ddd57584f044bf260e641905326f76c64c8e6be7e5e03d4fc599d"],["6057170b1dd12fdf8de05f281d8e06bb91e1493a8b91d4cc5a21382120a959e5","9a1af0b26a6a4807add9a2daf71df262465152bc3ee24c65e899be932385a2a8"],["a576df8e23a08411421439a4518da31880cef0fba7d4df12b1a6973eecb94266","40a6bf20e76640b2c92b97afe58cd82c432e10a7f514d9f3ee8be11ae1b28ec8"],["7778a78c28dec3e30a05fe9629de8c38bb30d1f5cf9a3a208f763889be58ad71","34626d9ab5a5b22ff7098e12f2ff580087b38411ff24ac563b513fc1fd9f43ac"],["928955ee637a84463729fd30e7afd2ed5f96274e5ad7e5cb09eda9c06d903ac","c25621003d3f42a827b78a13093a95eeac3d26efa8a8d83fc5180e935bcd091f"],["85d0fef3ec6db109399064f3a0e3b2855645b4a907ad354527aae75163d82751","1f03648413a38c0be29d496e582cf5663e8751e96877331582c237a24eb1f962"],["ff2b0dce97eece97c1c9b6041798b85dfdfb6d8882da20308f5404824526087e","493d13fef524ba188af4c4dc54d07936c7b7ed6fb90e2ceb2c951e01f0c29907"],["827fbbe4b1e880ea9ed2b2e6301b212b57f1ee148cd6dd28780e5e2cf856e241","c60f9c923c727b0b71bef2c67d1d12687ff7a63186903166d605b68baec293ec"],["eaa649f21f51bdbae7be4ae34ce6e5217a58fdce7f47f9aa7f3b58fa2120e2b3","be3279ed5bbbb03ac69a80f89879aa5a01a6b965f13f7e59d47a5305ba5ad93d"],["e4a42d43c5cf169d9391df6decf42ee541b6d8f0c9a137401e23632dda34d24f","4d9f92e716d1c73526fc99ccfb8ad34ce886eedfa8d8e4f13a7f7131deba9414"],["1ec80fef360cbdd954160fadab352b6b92b53576a88fea4947173b9d4300bf19","aeefe93756b5340d2f3a4958a7abbf5e0146e77f6295a07b671cdc1cc107cefd"],["146a778c04670c2f91b00af4680dfa8bce3490717d58ba889ddb5928366642be","b318e0ec3354028add669827f9d4b2870aaa971d2f7e5ed1d0b297483d83efd0"],["fa50c0f61d22e5f07e3acebb1aa07b128d0012209a28b9776d76a8793180eef9","6b84c6922397eba9b72cd2872281a68a5e683293a57a213b38cd8d7d3f4f2811"],["da1d61d0ca721a11b1a5bf6b7d88e8421a288ab5d5bba5220e53d32b5f067ec2","8157f55a7c99306c79c0766161c91e2966a73899d279b48a655fba0f1ad836f1"],["a8e282ff0c9706907215ff98e8fd416615311de0446f1e062a73b0610d064e13","7f97355b8db81c09abfb7f3c5b2515888b679a3e50dd6bd6cef7c73111f4cc0c"],["174a53b9c9a285872d39e56e6913cab15d59b1fa512508c022f382de8319497c","ccc9dc37abfc9c1657b4155f2c47f9e6646b3a1d8cb9854383da13ac079afa73"],["959396981943785c3d3e57edf5018cdbe039e730e4918b3d884fdff09475b7ba","2e7e552888c331dd8ba0386a4b9cd6849c653f64c8709385e9b8abf87524f2fd"],["d2a63a50ae401e56d645a1153b109a8fcca0a43d561fba2dbb51340c9d82b151","e82d86fb6443fcb7565aee58b2948220a70f750af484ca52d4142174dcf89405"],["64587e2335471eb890ee7896d7cfdc866bacbdbd3839317b3436f9b45617e073","d99fcdd5bf6902e2ae96dd6447c299a185b90a39133aeab358299e5e9faf6589"],["8481bde0e4e4d885b3a546d3e549de042f0aa6cea250e7fd358d6c86dd45e458","38ee7b8cba5404dd84a25bf39cecb2ca900a79c42b262e556d64b1b59779057e"],["13464a57a78102aa62b6979ae817f4637ffcfed3c4b1ce30bcd6303f6caf666b","69be159004614580ef7e433453ccb0ca48f300a81d0942e13f495a907f6ecc27"],["bc4a9df5b713fe2e9aef430bcc1dc97a0cd9ccede2f28588cada3a0d2d83f366","d3a81ca6e785c06383937adf4b798caa6e8a9fbfa547b16d758d666581f33c1"],["8c28a97bf8298bc0d23d8c749452a32e694b65e30a9472a3954ab30fe5324caa","40a30463a3305193378fedf31f7cc0eb7ae784f0451cb9459e71dc73cbef9482"],["8ea9666139527a8c1dd94ce4f071fd23c8b350c5a4bb33748c4ba111faccae0","620efabbc8ee2782e24e7c0cfb95c5d735b783be9cf0f8e955af34a30e62b945"],["dd3625faef5ba06074669716bbd3788d89bdde815959968092f76cc4eb9a9787","7a188fa3520e30d461da2501045731ca941461982883395937f68d00c644a573"],["f710d79d9eb962297e4f6232b40e8f7feb2bc63814614d692c12de752408221e","ea98e67232d3b3295d3b535532115ccac8612c721851617526ae47a9c77bfc82"]]},naf:{wnd:7,points:[["f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9","388f7b0f632de8140fe337e62a37f3566500a99934c2231b6cb9fd7584b8e672"],["2f8bde4d1a07209355b4a7250a5c5128e88b84bddc619ab7cba8d569b240efe4","d8ac222636e5e3d6d4dba9dda6c9c426f788271bab0d6840dca87d3aa6ac62d6"],["5cbdf0646e5db4eaa398f365f2ea7a0e3d419b7e0330e39ce92bddedcac4f9bc","6aebca40ba255960a3178d6d861a54dba813d0b813fde7b5a5082628087264da"],["acd484e2f0c7f65309ad178a9f559abde09796974c57e714c35f110dfc27ccbe","cc338921b0a7d9fd64380971763b61e9add888a4375f8e0f05cc262ac64f9c37"],["774ae7f858a9411e5ef4246b70c65aac5649980be5c17891bbec17895da008cb","d984a032eb6b5e190243dd56d7b7b365372db1e2dff9d6a8301d74c9c953c61b"],["f28773c2d975288bc7d1d205c3748651b075fbc6610e58cddeeddf8f19405aa8","ab0902e8d880a89758212eb65cdaf473a1a06da521fa91f29b5cb52db03ed81"],["d7924d4f7d43ea965a465ae3095ff41131e5946f3c85f79e44adbcf8e27e080e","581e2872a86c72a683842ec228cc6defea40af2bd896d3a5c504dc9ff6a26b58"],["defdea4cdb677750a420fee807eacf21eb9898ae79b9768766e4faa04a2d4a34","4211ab0694635168e997b0ead2a93daeced1f4a04a95c0f6cfb199f69e56eb77"],["2b4ea0a797a443d293ef5cff444f4979f06acfebd7e86d277475656138385b6c","85e89bc037945d93b343083b5a1c86131a01f60c50269763b570c854e5c09b7a"],["352bbf4a4cdd12564f93fa332ce333301d9ad40271f8107181340aef25be59d5","321eb4075348f534d59c18259dda3e1f4a1b3b2e71b1039c67bd3d8bcf81998c"],["2fa2104d6b38d11b0230010559879124e42ab8dfeff5ff29dc9cdadd4ecacc3f","2de1068295dd865b64569335bd5dd80181d70ecfc882648423ba76b532b7d67"],["9248279b09b4d68dab21a9b066edda83263c3d84e09572e269ca0cd7f5453714","73016f7bf234aade5d1aa71bdea2b1ff3fc0de2a887912ffe54a32ce97cb3402"],["daed4f2be3a8bf278e70132fb0beb7522f570e144bf615c07e996d443dee8729","a69dce4a7d6c98e8d4a1aca87ef8d7003f83c230f3afa726ab40e52290be1c55"],["c44d12c7065d812e8acf28d7cbb19f9011ecd9e9fdf281b0e6a3b5e87d22e7db","2119a460ce326cdc76c45926c982fdac0e106e861edf61c5a039063f0e0e6482"],["6a245bf6dc698504c89a20cfded60853152b695336c28063b61c65cbd269e6b4","e022cf42c2bd4a708b3f5126f16a24ad8b33ba48d0423b6efd5e6348100d8a82"],["1697ffa6fd9de627c077e3d2fe541084ce13300b0bec1146f95ae57f0d0bd6a5","b9c398f186806f5d27561506e4557433a2cf15009e498ae7adee9d63d01b2396"],["605bdb019981718b986d0f07e834cb0d9deb8360ffb7f61df982345ef27a7479","2972d2de4f8d20681a78d93ec96fe23c26bfae84fb14db43b01e1e9056b8c49"],["62d14dab4150bf497402fdc45a215e10dcb01c354959b10cfe31c7e9d87ff33d","80fc06bd8cc5b01098088a1950eed0db01aa132967ab472235f5642483b25eaf"],["80c60ad0040f27dade5b4b06c408e56b2c50e9f56b9b8b425e555c2f86308b6f","1c38303f1cc5c30f26e66bad7fe72f70a65eed4cbe7024eb1aa01f56430bd57a"],["7a9375ad6167ad54aa74c6348cc54d344cc5dc9487d847049d5eabb0fa03c8fb","d0e3fa9eca8726909559e0d79269046bdc59ea10c70ce2b02d499ec224dc7f7"],["d528ecd9b696b54c907a9ed045447a79bb408ec39b68df504bb51f459bc3ffc9","eecf41253136e5f99966f21881fd656ebc4345405c520dbc063465b521409933"],["49370a4b5f43412ea25f514e8ecdad05266115e4a7ecb1387231808f8b45963","758f3f41afd6ed428b3081b0512fd62a54c3f3afbb5b6764b653052a12949c9a"],["77f230936ee88cbbd73df930d64702ef881d811e0e1498e2f1c13eb1fc345d74","958ef42a7886b6400a08266e9ba1b37896c95330d97077cbbe8eb3c7671c60d6"],["f2dac991cc4ce4b9ea44887e5c7c0bce58c80074ab9d4dbaeb28531b7739f530","e0dedc9b3b2f8dad4da1f32dec2531df9eb5fbeb0598e4fd1a117dba703a3c37"],["463b3d9f662621fb1b4be8fbbe2520125a216cdfc9dae3debcba4850c690d45b","5ed430d78c296c3543114306dd8622d7c622e27c970a1de31cb377b01af7307e"],["f16f804244e46e2a09232d4aff3b59976b98fac14328a2d1a32496b49998f247","cedabd9b82203f7e13d206fcdf4e33d92a6c53c26e5cce26d6579962c4e31df6"],["caf754272dc84563b0352b7a14311af55d245315ace27c65369e15f7151d41d1","cb474660ef35f5f2a41b643fa5e460575f4fa9b7962232a5c32f908318a04476"],["2600ca4b282cb986f85d0f1709979d8b44a09c07cb86d7c124497bc86f082120","4119b88753c15bd6a693b03fcddbb45d5ac6be74ab5f0ef44b0be9475a7e4b40"],["7635ca72d7e8432c338ec53cd12220bc01c48685e24f7dc8c602a7746998e435","91b649609489d613d1d5e590f78e6d74ecfc061d57048bad9e76f302c5b9c61"],["754e3239f325570cdbbf4a87deee8a66b7f2b33479d468fbc1a50743bf56cc18","673fb86e5bda30fb3cd0ed304ea49a023ee33d0197a695d0c5d98093c536683"],["e3e6bd1071a1e96aff57859c82d570f0330800661d1c952f9fe2694691d9b9e8","59c9e0bba394e76f40c0aa58379a3cb6a5a2283993e90c4167002af4920e37f5"],["186b483d056a033826ae73d88f732985c4ccb1f32ba35f4b4cc47fdcf04aa6eb","3b952d32c67cf77e2e17446e204180ab21fb8090895138b4a4a797f86e80888b"],["df9d70a6b9876ce544c98561f4be4f725442e6d2b737d9c91a8321724ce0963f","55eb2dafd84d6ccd5f862b785dc39d4ab157222720ef9da217b8c45cf2ba2417"],["5edd5cc23c51e87a497ca815d5dce0f8ab52554f849ed8995de64c5f34ce7143","efae9c8dbc14130661e8cec030c89ad0c13c66c0d17a2905cdc706ab7399a868"],["290798c2b6476830da12fe02287e9e777aa3fba1c355b17a722d362f84614fba","e38da76dcd440621988d00bcf79af25d5b29c094db2a23146d003afd41943e7a"],["af3c423a95d9f5b3054754efa150ac39cd29552fe360257362dfdecef4053b45","f98a3fd831eb2b749a93b0e6f35cfb40c8cd5aa667a15581bc2feded498fd9c6"],["766dbb24d134e745cccaa28c99bf274906bb66b26dcf98df8d2fed50d884249a","744b1152eacbe5e38dcc887980da38b897584a65fa06cedd2c924f97cbac5996"],["59dbf46f8c94759ba21277c33784f41645f7b44f6c596a58ce92e666191abe3e","c534ad44175fbc300f4ea6ce648309a042ce739a7919798cd85e216c4a307f6e"],["f13ada95103c4537305e691e74e9a4a8dd647e711a95e73cb62dc6018cfd87b8","e13817b44ee14de663bf4bc808341f326949e21a6a75c2570778419bdaf5733d"],["7754b4fa0e8aced06d4167a2c59cca4cda1869c06ebadfb6488550015a88522c","30e93e864e669d82224b967c3020b8fa8d1e4e350b6cbcc537a48b57841163a2"],["948dcadf5990e048aa3874d46abef9d701858f95de8041d2a6828c99e2262519","e491a42537f6e597d5d28a3224b1bc25df9154efbd2ef1d2cbba2cae5347d57e"],["7962414450c76c1689c7b48f8202ec37fb224cf5ac0bfa1570328a8a3d7c77ab","100b610ec4ffb4760d5c1fc133ef6f6b12507a051f04ac5760afa5b29db83437"],["3514087834964b54b15b160644d915485a16977225b8847bb0dd085137ec47ca","ef0afbb2056205448e1652c48e8127fc6039e77c15c2378b7e7d15a0de293311"],["d3cc30ad6b483e4bc79ce2c9dd8bc54993e947eb8df787b442943d3f7b527eaf","8b378a22d827278d89c5e9be8f9508ae3c2ad46290358630afb34db04eede0a4"],["1624d84780732860ce1c78fcbfefe08b2b29823db913f6493975ba0ff4847610","68651cf9b6da903e0914448c6cd9d4ca896878f5282be4c8cc06e2a404078575"],["733ce80da955a8a26902c95633e62a985192474b5af207da6df7b4fd5fc61cd4","f5435a2bd2badf7d485a4d8b8db9fcce3e1ef8e0201e4578c54673bc1dc5ea1d"],["15d9441254945064cf1a1c33bbd3b49f8966c5092171e699ef258dfab81c045c","d56eb30b69463e7234f5137b73b84177434800bacebfc685fc37bbe9efe4070d"],["a1d0fcf2ec9de675b612136e5ce70d271c21417c9d2b8aaaac138599d0717940","edd77f50bcb5a3cab2e90737309667f2641462a54070f3d519212d39c197a629"],["e22fbe15c0af8ccc5780c0735f84dbe9a790badee8245c06c7ca37331cb36980","a855babad5cd60c88b430a69f53a1a7a38289154964799be43d06d77d31da06"],["311091dd9860e8e20ee13473c1155f5f69635e394704eaa74009452246cfa9b3","66db656f87d1f04fffd1f04788c06830871ec5a64feee685bd80f0b1286d8374"],["34c1fd04d301be89b31c0442d3e6ac24883928b45a9340781867d4232ec2dbdf","9414685e97b1b5954bd46f730174136d57f1ceeb487443dc5321857ba73abee"],["f219ea5d6b54701c1c14de5b557eb42a8d13f3abbcd08affcc2a5e6b049b8d63","4cb95957e83d40b0f73af4544cccf6b1f4b08d3c07b27fb8d8c2962a400766d1"],["d7b8740f74a8fbaab1f683db8f45de26543a5490bca627087236912469a0b448","fa77968128d9c92ee1010f337ad4717eff15db5ed3c049b3411e0315eaa4593b"],["32d31c222f8f6f0ef86f7c98d3a3335ead5bcd32abdd94289fe4d3091aa824bf","5f3032f5892156e39ccd3d7915b9e1da2e6dac9e6f26e961118d14b8462e1661"],["7461f371914ab32671045a155d9831ea8793d77cd59592c4340f86cbc18347b5","8ec0ba238b96bec0cbdddcae0aa442542eee1ff50c986ea6b39847b3cc092ff6"],["ee079adb1df1860074356a25aa38206a6d716b2c3e67453d287698bad7b2b2d6","8dc2412aafe3be5c4c5f37e0ecc5f9f6a446989af04c4e25ebaac479ec1c8c1e"],["16ec93e447ec83f0467b18302ee620f7e65de331874c9dc72bfd8616ba9da6b5","5e4631150e62fb40d0e8c2a7ca5804a39d58186a50e497139626778e25b0674d"],["eaa5f980c245f6f038978290afa70b6bd8855897f98b6aa485b96065d537bd99","f65f5d3e292c2e0819a528391c994624d784869d7e6ea67fb18041024edc07dc"],["78c9407544ac132692ee1910a02439958ae04877151342ea96c4b6b35a49f51","f3e0319169eb9b85d5404795539a5e68fa1fbd583c064d2462b675f194a3ddb4"],["494f4be219a1a77016dcd838431aea0001cdc8ae7a6fc688726578d9702857a5","42242a969283a5f339ba7f075e36ba2af925ce30d767ed6e55f4b031880d562c"],["a598a8030da6d86c6bc7f2f5144ea549d28211ea58faa70ebf4c1e665c1fe9b5","204b5d6f84822c307e4b4a7140737aec23fc63b65b35f86a10026dbd2d864e6b"],["c41916365abb2b5d09192f5f2dbeafec208f020f12570a184dbadc3e58595997","4f14351d0087efa49d245b328984989d5caf9450f34bfc0ed16e96b58fa9913"],["841d6063a586fa475a724604da03bc5b92a2e0d2e0a36acfe4c73a5514742881","73867f59c0659e81904f9a1c7543698e62562d6744c169ce7a36de01a8d6154"],["5e95bb399a6971d376026947f89bde2f282b33810928be4ded112ac4d70e20d5","39f23f366809085beebfc71181313775a99c9aed7d8ba38b161384c746012865"],["36e4641a53948fd476c39f8a99fd974e5ec07564b5315d8bf99471bca0ef2f66","d2424b1b1abe4eb8164227b085c9aa9456ea13493fd563e06fd51cf5694c78fc"],["336581ea7bfbbb290c191a2f507a41cf5643842170e914faeab27c2c579f726","ead12168595fe1be99252129b6e56b3391f7ab1410cd1e0ef3dcdcabd2fda224"],["8ab89816dadfd6b6a1f2634fcf00ec8403781025ed6890c4849742706bd43ede","6fdcef09f2f6d0a044e654aef624136f503d459c3e89845858a47a9129cdd24e"],["1e33f1a746c9c5778133344d9299fcaa20b0938e8acff2544bb40284b8c5fb94","60660257dd11b3aa9c8ed618d24edff2306d320f1d03010e33a7d2057f3b3b6"],["85b7c1dcb3cec1b7ee7f30ded79dd20a0ed1f4cc18cbcfcfa410361fd8f08f31","3d98a9cdd026dd43f39048f25a8847f4fcafad1895d7a633c6fed3c35e999511"],["29df9fbd8d9e46509275f4b125d6d45d7fbe9a3b878a7af872a2800661ac5f51","b4c4fe99c775a606e2d8862179139ffda61dc861c019e55cd2876eb2a27d84b"],["a0b1cae06b0a847a3fea6e671aaf8adfdfe58ca2f768105c8082b2e449fce252","ae434102edde0958ec4b19d917a6a28e6b72da1834aff0e650f049503a296cf2"],["4e8ceafb9b3e9a136dc7ff67e840295b499dfb3b2133e4ba113f2e4c0e121e5","cf2174118c8b6d7a4b48f6d534ce5c79422c086a63460502b827ce62a326683c"],["d24a44e047e19b6f5afb81c7ca2f69080a5076689a010919f42725c2b789a33b","6fb8d5591b466f8fc63db50f1c0f1c69013f996887b8244d2cdec417afea8fa3"],["ea01606a7a6c9cdd249fdfcfacb99584001edd28abbab77b5104e98e8e3b35d4","322af4908c7312b0cfbfe369f7a7b3cdb7d4494bc2823700cfd652188a3ea98d"],["af8addbf2b661c8a6c6328655eb96651252007d8c5ea31be4ad196de8ce2131f","6749e67c029b85f52a034eafd096836b2520818680e26ac8f3dfbcdb71749700"],["e3ae1974566ca06cc516d47e0fb165a674a3dabcfca15e722f0e3450f45889","2aeabe7e4531510116217f07bf4d07300de97e4874f81f533420a72eeb0bd6a4"],["591ee355313d99721cf6993ffed1e3e301993ff3ed258802075ea8ced397e246","b0ea558a113c30bea60fc4775460c7901ff0b053d25ca2bdeee98f1a4be5d196"],["11396d55fda54c49f19aa97318d8da61fa8584e47b084945077cf03255b52984","998c74a8cd45ac01289d5833a7beb4744ff536b01b257be4c5767bea93ea57a4"],["3c5d2a1ba39c5a1790000738c9e0c40b8dcdfd5468754b6405540157e017aa7a","b2284279995a34e2f9d4de7396fc18b80f9b8b9fdd270f6661f79ca4c81bd257"],["cc8704b8a60a0defa3a99a7299f2e9c3fbc395afb04ac078425ef8a1793cc030","bdd46039feed17881d1e0862db347f8cf395b74fc4bcdc4e940b74e3ac1f1b13"],["c533e4f7ea8555aacd9777ac5cad29b97dd4defccc53ee7ea204119b2889b197","6f0a256bc5efdf429a2fb6242f1a43a2d9b925bb4a4b3a26bb8e0f45eb596096"],["c14f8f2ccb27d6f109f6d08d03cc96a69ba8c34eec07bbcf566d48e33da6593","c359d6923bb398f7fd4473e16fe1c28475b740dd098075e6c0e8649113dc3a38"],["a6cbc3046bc6a450bac24789fa17115a4c9739ed75f8f21ce441f72e0b90e6ef","21ae7f4680e889bb130619e2c0f95a360ceb573c70603139862afd617fa9b9f"],["347d6d9a02c48927ebfb86c1359b1caf130a3c0267d11ce6344b39f99d43cc38","60ea7f61a353524d1c987f6ecec92f086d565ab687870cb12689ff1e31c74448"],["da6545d2181db8d983f7dcb375ef5866d47c67b1bf31c8cf855ef7437b72656a","49b96715ab6878a79e78f07ce5680c5d6673051b4935bd897fea824b77dc208a"],["c40747cc9d012cb1a13b8148309c6de7ec25d6945d657146b9d5994b8feb1111","5ca560753be2a12fc6de6caf2cb489565db936156b9514e1bb5e83037e0fa2d4"],["4e42c8ec82c99798ccf3a610be870e78338c7f713348bd34c8203ef4037f3502","7571d74ee5e0fb92a7a8b33a07783341a5492144cc54bcc40a94473693606437"],["3775ab7089bc6af823aba2e1af70b236d251cadb0c86743287522a1b3b0dedea","be52d107bcfa09d8bcb9736a828cfa7fac8db17bf7a76a2c42ad961409018cf7"],["cee31cbf7e34ec379d94fb814d3d775ad954595d1314ba8846959e3e82f74e26","8fd64a14c06b589c26b947ae2bcf6bfa0149ef0be14ed4d80f448a01c43b1c6d"],["b4f9eaea09b6917619f6ea6a4eb5464efddb58fd45b1ebefcdc1a01d08b47986","39e5c9925b5a54b07433a4f18c61726f8bb131c012ca542eb24a8ac07200682a"],["d4263dfc3d2df923a0179a48966d30ce84e2515afc3dccc1b77907792ebcc60e","62dfaf07a0f78feb30e30d6295853ce189e127760ad6cf7fae164e122a208d54"],["48457524820fa65a4f8d35eb6930857c0032acc0a4a2de422233eeda897612c4","25a748ab367979d98733c38a1fa1c2e7dc6cc07db2d60a9ae7a76aaa49bd0f77"],["dfeeef1881101f2cb11644f3a2afdfc2045e19919152923f367a1767c11cceda","ecfb7056cf1de042f9420bab396793c0c390bde74b4bbdff16a83ae09a9a7517"],["6d7ef6b17543f8373c573f44e1f389835d89bcbc6062ced36c82df83b8fae859","cd450ec335438986dfefa10c57fea9bcc521a0959b2d80bbf74b190dca712d10"],["e75605d59102a5a2684500d3b991f2e3f3c88b93225547035af25af66e04541f","f5c54754a8f71ee540b9b48728473e314f729ac5308b06938360990e2bfad125"],["eb98660f4c4dfaa06a2be453d5020bc99a0c2e60abe388457dd43fefb1ed620c","6cb9a8876d9cb8520609af3add26cd20a0a7cd8a9411131ce85f44100099223e"],["13e87b027d8514d35939f2e6892b19922154596941888336dc3563e3b8dba942","fef5a3c68059a6dec5d624114bf1e91aac2b9da568d6abeb2570d55646b8adf1"],["ee163026e9fd6fe017c38f06a5be6fc125424b371ce2708e7bf4491691e5764a","1acb250f255dd61c43d94ccc670d0f58f49ae3fa15b96623e5430da0ad6c62b2"],["b268f5ef9ad51e4d78de3a750c2dc89b1e626d43505867999932e5db33af3d80","5f310d4b3c99b9ebb19f77d41c1dee018cf0d34fd4191614003e945a1216e423"],["ff07f3118a9df035e9fad85eb6c7bfe42b02f01ca99ceea3bf7ffdba93c4750d","438136d603e858a3a5c440c38eccbaddc1d2942114e2eddd4740d098ced1f0d8"],["8d8b9855c7c052a34146fd20ffb658bea4b9f69e0d825ebec16e8c3ce2b526a1","cdb559eedc2d79f926baf44fb84ea4d44bcf50fee51d7ceb30e2e7f463036758"],["52db0b5384dfbf05bfa9d472d7ae26dfe4b851ceca91b1eba54263180da32b63","c3b997d050ee5d423ebaf66a6db9f57b3180c902875679de924b69d84a7b375"],["e62f9490d3d51da6395efd24e80919cc7d0f29c3f3fa48c6fff543becbd43352","6d89ad7ba4876b0b22c2ca280c682862f342c8591f1daf5170e07bfd9ccafa7d"],["7f30ea2476b399b4957509c88f77d0191afa2ff5cb7b14fd6d8e7d65aaab1193","ca5ef7d4b231c94c3b15389a5f6311e9daff7bb67b103e9880ef4bff637acaec"],["5098ff1e1d9f14fb46a210fada6c903fef0fb7b4a1dd1d9ac60a0361800b7a00","9731141d81fc8f8084d37c6e7542006b3ee1b40d60dfe5362a5b132fd17ddc0"],["32b78c7de9ee512a72895be6b9cbefa6e2f3c4ccce445c96b9f2c81e2778ad58","ee1849f513df71e32efc3896ee28260c73bb80547ae2275ba497237794c8753c"],["e2cb74fddc8e9fbcd076eef2a7c72b0ce37d50f08269dfc074b581550547a4f7","d3aa2ed71c9dd2247a62df062736eb0baddea9e36122d2be8641abcb005cc4a4"],["8438447566d4d7bedadc299496ab357426009a35f235cb141be0d99cd10ae3a8","c4e1020916980a4da5d01ac5e6ad330734ef0d7906631c4f2390426b2edd791f"],["4162d488b89402039b584c6fc6c308870587d9c46f660b878ab65c82c711d67e","67163e903236289f776f22c25fb8a3afc1732f2b84b4e95dbda47ae5a0852649"],["3fad3fa84caf0f34f0f89bfd2dcf54fc175d767aec3e50684f3ba4a4bf5f683d","cd1bc7cb6cc407bb2f0ca647c718a730cf71872e7d0d2a53fa20efcdfe61826"],["674f2600a3007a00568c1a7ce05d0816c1fb84bf1370798f1c69532faeb1a86b","299d21f9413f33b3edf43b257004580b70db57da0b182259e09eecc69e0d38a5"],["d32f4da54ade74abb81b815ad1fb3b263d82d6c692714bcff87d29bd5ee9f08f","f9429e738b8e53b968e99016c059707782e14f4535359d582fc416910b3eea87"],["30e4e670435385556e593657135845d36fbb6931f72b08cb1ed954f1e3ce3ff6","462f9bce619898638499350113bbc9b10a878d35da70740dc695a559eb88db7b"],["be2062003c51cc3004682904330e4dee7f3dcd10b01e580bf1971b04d4cad297","62188bc49d61e5428573d48a74e1c655b1c61090905682a0d5558ed72dccb9bc"],["93144423ace3451ed29e0fb9ac2af211cb6e84a601df5993c419859fff5df04a","7c10dfb164c3425f5c71a3f9d7992038f1065224f72bb9d1d902a6d13037b47c"],["b015f8044f5fcbdcf21ca26d6c34fb8197829205c7b7d2a7cb66418c157b112c","ab8c1e086d04e813744a655b2df8d5f83b3cdc6faa3088c1d3aea1454e3a1d5f"],["d5e9e1da649d97d89e4868117a465a3a4f8a18de57a140d36b3f2af341a21b52","4cb04437f391ed73111a13cc1d4dd0db1693465c2240480d8955e8592f27447a"],["d3ae41047dd7ca065dbf8ed77b992439983005cd72e16d6f996a5316d36966bb","bd1aeb21ad22ebb22a10f0303417c6d964f8cdd7df0aca614b10dc14d125ac46"],["463e2763d885f958fc66cdd22800f0a487197d0a82e377b49f80af87c897b065","bfefacdb0e5d0fd7df3a311a94de062b26b80c61fbc97508b79992671ef7ca7f"],["7985fdfd127c0567c6f53ec1bb63ec3158e597c40bfe747c83cddfc910641917","603c12daf3d9862ef2b25fe1de289aed24ed291e0ec6708703a5bd567f32ed03"],["74a1ad6b5f76e39db2dd249410eac7f99e74c59cb83d2d0ed5ff1543da7703e9","cc6157ef18c9c63cd6193d83631bbea0093e0968942e8c33d5737fd790e0db08"],["30682a50703375f602d416664ba19b7fc9bab42c72747463a71d0896b22f6da3","553e04f6b018b4fa6c8f39e7f311d3176290d0e0f19ca73f17714d9977a22ff8"],["9e2158f0d7c0d5f26c3791efefa79597654e7a2b2464f52b1ee6c1347769ef57","712fcdd1b9053f09003a3481fa7762e9ffd7c8ef35a38509e2fbf2629008373"],["176e26989a43c9cfeba4029c202538c28172e566e3c4fce7322857f3be327d66","ed8cc9d04b29eb877d270b4878dc43c19aefd31f4eee09ee7b47834c1fa4b1c3"],["75d46efea3771e6e68abb89a13ad747ecf1892393dfc4f1b7004788c50374da8","9852390a99507679fd0b86fd2b39a868d7efc22151346e1a3ca4726586a6bed8"],["809a20c67d64900ffb698c4c825f6d5f2310fb0451c869345b7319f645605721","9e994980d9917e22b76b061927fa04143d096ccc54963e6a5ebfa5f3f8e286c1"],["1b38903a43f7f114ed4500b4eac7083fdefece1cf29c63528d563446f972c180","4036edc931a60ae889353f77fd53de4a2708b26b6f5da72ad3394119daf408f9"]]}}},{}],33:[function(e,t,r){"use strict";var n=r,i=e("bn.js"),a=e("minimalistic-assert"),s=e("minimalistic-crypto-utils");n.assert=a,n.toArray=s.toArray,n.zero2=s.zero2,n.toHex=s.toHex,n.encode=s.encode,n.getNAF=function(e,t){for(var r=[],n=1<<t+1,i=e.clone();i.cmpn(1)>=0;){var a;if(i.isOdd()){var s=i.andln(n-1);a=s>(n>>1)-1?(n>>1)-s:s,i.isubn(a)}else a=0;r.push(a);for(var o=0!==i.cmpn(0)&&0===i.andln(n-1)?t+1:1,u=1;u<o;u++)r.push(0);i.iushrn(o)}return r},n.getJSF=function(e,t){var r=[[],[]];e=e.clone(),t=t.clone();for(var n=0,i=0;e.cmpn(-n)>0||t.cmpn(-i)>0;){var a,s,o,u=e.andln(3)+n&3,c=t.andln(3)+i&3;3===u&&(u=-1),3===c&&(c=-1),a=0==(1&u)?0:3!=(o=e.andln(7)+n&7)&&5!==o||2!==c?u:-u,r[0].push(a),s=0==(1&c)?0:3!=(o=t.andln(7)+i&7)&&5!==o||2!==u?c:-c,r[1].push(s),2*n===a+1&&(n=1-n),2*i===s+1&&(i=1-i),e.iushrn(1),t.iushrn(1)}return r},n.cachedProperty=function(e,t,r){var n="_"+t;e.prototype[t]=function(){return void 0!==this[n]?this[n]:this[n]=r.call(this)}},n.parseBytes=function(e){return"string"==typeof e?n.toArray(e,"hex"):e},n.intFromLE=function(e){return new i(e,"hex","le")}},{"bn.js":17,"minimalistic-assert":50,"minimalistic-crypto-utils":51}],34:[function(e,t,r){t.exports={_args:[["github:openpgpjs/elliptic#ad81845","/Users/sunny/Desktop/Protonmail/openpgpjs"]],_from:"github:openpgpjs/elliptic#ad81845",_id:"elliptic@github:openpgpjs/elliptic#ad81845f693effa5b4b6d07db2e82112de222f48",_inBundle:!1,_integrity:"",_location:"/elliptic",_phantomChildren:{},_requested:{type:"git",raw:"github:openpgpjs/elliptic#ad81845",rawSpec:"github:openpgpjs/elliptic#ad81845",saveSpec:"github:openpgpjs/elliptic#ad81845",fetchSpec:null,gitCommittish:"ad81845"},_requiredBy:["/"],_resolved:"github:openpgpjs/elliptic#ad81845f693effa5b4b6d07db2e82112de222f48",_spec:"github:openpgpjs/elliptic#ad81845",_where:"/Users/sunny/Desktop/Protonmail/openpgpjs",author:{name:"Fedor Indutny",email:"fedor@indutny.com"},bugs:{url:"https://github.com/indutny/elliptic/issues"},dependencies:{"bn.js":"^4.4.0",brorand:"^1.0.1","hash.js":"^1.0.0","hmac-drbg":"^1.0.0",inherits:"^2.0.1","minimalistic-assert":"^1.0.0","minimalistic-crypto-utils":"^1.0.0"},description:"EC cryptography",devDependencies:{brfs:"^1.4.3",coveralls:"^2.11.3",grunt:"^0.4.5","grunt-browserify":"^5.0.0","grunt-cli":"^1.2.0","grunt-contrib-connect":"^1.0.0","grunt-contrib-copy":"^1.0.0","grunt-contrib-uglify":"^1.0.1","grunt-mocha-istanbul":"^3.0.1","grunt-saucelabs":"^8.6.2",istanbul:"^0.4.2",jscs:"^2.9.0",jshint:"^2.6.0",mocha:"^2.1.0"},files:["lib"],homepage:"https://github.com/indutny/elliptic",keywords:["EC","Elliptic","curve","Cryptography"],license:"MIT",main:"lib/elliptic.js",name:"elliptic",repository:{type:"git",url:"git+ssh://git@github.com/indutny/elliptic.git"},scripts:{jscs:"jscs benchmarks/*.js lib/*.js lib/**/*.js lib/**/**/*.js test/index.js",jshint:"jscs benchmarks/*.js lib/*.js lib/**/*.js lib/**/**/*.js test/index.js",lint:"npm run jscs && npm run jshint",test:"npm run lint && npm run unit",unit:"istanbul test _mocha --reporter=spec test/index.js",version:"grunt dist && git add dist/"},version:"6.4.0"}},{}],35:[function(e,t,r){!function(e){"use strict";function r(e){function t(){return ke<Ae}function r(){return ke}function i(e){ke=e}function a(){ke=0,Ae=ve.length}function s(e,t){return{name:e,tokens:t||"",semantic:t||"",children:[]}}function o(e,t){var r;return null===t?null:((r=s(e)).tokens=t.tokens,r.semantic=t.semantic,r.children.push(t),r)}function u(e,t){return null!==t&&(e.tokens+=t.tokens,e.semantic+=t.semantic),e.children.push(t),e}function c(e){var r;return t()&&e(r=ve[ke])?(ke+=1,s("token",r)):null}function f(e){return function(){return o("literal",c(function(t){return t===e}))}}function d(){var e=arguments;return function(){var t,n,a,o;for(o=r(),n=s("and"),t=0;t<e.length;t+=1){if(null===(a=e[t]()))return i(o),null;u(n,a)}return n}}function l(){var e=arguments;return function(){var t,n,a;for(a=r(),t=0;t<e.length;t+=1){if(null!==(n=e[t]()))return n;i(a)}return null}}function h(e){return function(){var t,n;return n=r(),null!==(t=e())?t:(i(n),s("opt"))}}function p(e){return function(){var t=e();return null!==t&&(t.semantic=""),t}}function y(e){return function(){var t=e();return null!==t&&t.semantic.length>0&&(t.semantic=" "),t}}function b(e,t){return function(){var n,a,o,c,f;for(c=r(),n=s("star"),o=0,f=void 0===t?0:t;null!==(a=e());)o+=1,u(n,a);return o>=f?n:(i(c),null)}}function m(e){return e.charCodeAt(0)>=128}function g(){return o("cr",f("\r")())}function w(){return o("crlf",d(g,k)())}function _(){return o("dquote",f('"')())}function v(){return o("htab",f("\t")())}function k(){return o("lf",f("\n")())}function A(){return o("sp",f(" ")())}function S(){return o("vchar",c(function(t){var r=t.charCodeAt(0),n=33<=r&&r<=126;return e.rfc6532&&(n=n||m(t)),n}))}function E(){return o("wsp",l(A,v)())}function P(){var e=o("quoted-pair",l(d(f("\\"),l(S,E)),ne)());return null===e?null:(e.semantic=e.semantic[1],e)}function x(){return o("fws",l(ae,d(h(d(b(E),p(w))),b(E,1)))())}function M(){return o("ctext",l(function(){return c(function(t){var r=t.charCodeAt(0),n=33<=r&&r<=39||42<=r&&r<=91||93<=r&&r<=126;return e.rfc6532&&(n=n||m(t)),n})},te)())}function C(){return o("ccontent",l(M,P,j)())}function j(){return o("comment",d(f("("),b(d(h(x),C)),h(x),f(")"))())}function R(){return o("cfws",l(d(b(d(h(x),j),1),h(x)),x)())}function B(){return o("atext",c(function(t){var r="a"<=t&&t<="z"||"A"<=t&&t<="Z"||"0"<=t&&t<="9"||["!","#","$","%","&","'","*","+","-","/","=","?","^","_","`","{","|","}","~"].indexOf(t)>=0;return e.rfc6532&&(r=r||m(t)),r}))}function K(){return o("atom",d(y(h(R)),b(B,1),y(h(R)))())}function I(){var e,t;return null===(e=o("dot-atom-text",b(B,1)()))?e:(null!==(t=b(d(f("."),b(B,1)))())&&u(e,t),e)}function U(){return o("dot-atom",d(p(h(R)),I,p(h(R)))())}function T(){return o("qtext",l(function(){return c(function(t){var r=t.charCodeAt(0),n=33===r||35<=r&&r<=91||93<=r&&r<=126;return e.rfc6532&&(n=n||m(t)),n})},re)())}function z(){return o("qcontent",l(T,P)())}function O(){return o("quoted-string",d(p(h(R)),p(_),b(d(h(y(x)),z)),h(p(x)),p(_),p(h(R)))())}function D(){return o("word",l(K,O)())}function N(){return o("address",l(q,W)())}function q(){return o("mailbox",l(F,Q)())}function F(){return o("name-addr",d(h(H),L)())}function L(){return o("angle-addr",l(d(p(h(R)),f("<"),Q,f(">"),p(h(R))),se)())}function W(){return o("group",d(H,f(":"),h(V),f(";"),p(h(R)))())}function H(){return o("display-name",(null!==(e=o("phrase",l(ie,b(D,1))()))&&(e.semantic=e.semantic.replace(/([ \t]|\r\n)+/g," ").replace(/^\s*/,"").replace(/\s*$/,"")),e));var e}function Z(){return o("mailbox-list",l(d(q,b(d(f(","),q))),ce)())}function G(){return o("address-list",l(d(N,b(d(f(","),N))),fe)())}function V(){return o("group-list",l(Z,p(R),de)())}function Y(){return o("local-part",l(le,U,O)())}function X(){return o("dtext",l(function(){return c(function(t){var r=t.charCodeAt(0),n=33<=r&&r<=90||94<=r&&r<=126;return e.rfc6532&&(n=n||m(t)),n})},pe)())}function $(){return o("domain-literal",d(p(h(R)),f("["),b(d(h(x),X)),h(x),f("]"),p(h(R)))())}function J(){return o("domain",(t=l(he,U,$)(),e.rejectTLD&&t.semantic.indexOf(".")<0?null:(t&&(t.semantic=t.semantic.replace(/\s+/g,"")),t)));var t}function Q(){return o("addr-spec",d(Y,f("@"),J)())}function ee(){return e.strict?null:o("obs-NO-WS-CTL",c(function(e){var t=e.charCodeAt(0);return 1<=t&&t<=8||11===t||12===t||14<=t&&t<=31||127===t}))}function te(){return e.strict?null:o("obs-ctext",ee())}function re(){return e.strict?null:o("obs-qtext",ee())}function ne(){return e.strict?null:o("obs-qp",d(f("\\"),l(f("\0"),ee,k,g))())}function ie(){return e.strict?null:o("obs-phrase",d(D,b(l(D,f("."),y(R))))())}function ae(){return e.strict?null:o("obs-FWS",b(d(p(h(w)),E),1)())}function se(){return e.strict?null:o("obs-angle-addr",d(p(h(R)),f("<"),oe,Q,f(">"),p(h(R)))())}function oe(){return e.strict?null:o("obs-route",d(ue,f(":"))())}function ue(){return e.strict?null:o("obs-domain-list",d(b(l(p(R),f(","))),f("@"),J,b(d(f(","),p(h(R)),h(d(f("@"),J)))))())}function ce(){return e.strict?null:o("obs-mbox-list",d(b(d(p(h(R)),f(","))),q,b(d(f(","),h(d(q,p(R))))))())}function fe(){return e.strict?null:o("obs-addr-list",d(b(d(p(h(R)),f(","))),N,b(d(f(","),h(d(N,p(R))))))())}function de(){return e.strict?null:o("obs-group-list",d(b(d(p(h(R)),f(",")),1),p(h(R)))())}function le(){return e.strict?null:o("obs-local-part",d(D,b(d(f("."),D)))())}function he(){return e.strict?null:o("obs-domain",d(K,b(d(f("."),K)))())}function pe(){return e.strict?null:o("obs-dtext",l(ee,P)())}function ye(e,t){var r,n,i;if(null==t)return null;for(n=[t];n.length>0;){if((i=n.pop()).name===e)return i;for(r=i.children.length-1;r>=0;r-=1)n.push(i.children[r])}return null}function be(e,t){var r,n,i,a,s;if(null==t)return null;for(n=[t],a=[],s={},r=0;r<e.length;r+=1)s[e[r]]=!0;for(;n.length>0;)if((i=n.pop()).name in s)a.push(i);else for(r=i.children.length-1;r>=0;r-=1)n.push(i.children[r]);return a}function me(t){var r,n,i,a,s;if(null===t)return null;for(r=[],n=be(["group","mailbox"],t),i=0;i<n.length;i+=1)"group"===(a=n[i]).name?r.push(ge(a)):"mailbox"===a.name&&r.push(we(a));return s={ast:t,addresses:r},e.simple&&(s=function(e){var t;if(e&&e.addresses)for(t=0;t<e.addresses.length;t+=1)delete e.addresses[t].node;return e}(s)),e.oneResult?function(t){if(!t)return null;if(!e.partial&&t.addresses.length>1)return null;return t.addresses&&t.addresses[0]}(s):e.simple?s&&s.addresses:s}function ge(e){var t,r=ye("display-name",e),n=[],i=be(["mailbox"],e);for(t=0;t<i.length;t+=1)n.push(we(i[t]));return{node:e,parts:{name:r},type:e.name,name:_e(r),addresses:n}}function we(e){var t=ye("display-name",e),r=ye("addr-spec",e),n=function(e,t){var r,n,i,a;if(null==t)return null;for(n=[t],a=[];n.length>0;)for((i=n.pop()).name===e&&a.push(i),r=i.children.length-1;r>=0;r-=1)n.push(i.children[r]);return a}("cfws",e),i=ye("local-part",r),a=ye("domain",r);return{node:e,parts:{name:t,address:r,local:i,domain:a,comments:n},type:e.name,name:_e(t),address:_e(r),local:_e(i),domain:_e(a),groupName:_e(e.groupName)}}function _e(e){return null!=e?e.semantic:null}var ve,ke,Ae,Se,Ee;if(null===(e=n(e,{})))return null;if(ve=e.input,Ee={address:N,"address-list":G,"angle-addr":L,from:function(){return o("from",l(Z,G)())},group:W,mailbox:q,"mailbox-list":Z,"reply-to":function(){return o("reply-to",G())},sender:function(){return o("sender",l(q,N)())}}[e.startAt]||G,!e.strict){if(a(),e.strict=!0,Se=Ee(ve),e.partial||!t())return me(Se);e.strict=!1}return a(),Se=Ee(ve),!e.partial&&t()?null:me(Se)}function n(e,t){function r(e){return"[object String]"===Object.prototype.toString.call(e)}function n(e){return null==e}var i,a;if(r(e))e={input:e};else if(!function(e){return e===Object(e)}(e))return null;if(!r(e.input))return null;if(!t)return null;for(a in i={oneResult:!1,partial:!1,rejectTLD:!1,rfc6532:!1,simple:!1,startAt:"address-list",strict:!1})n(e[a])&&(e[a]=n(t[a])?i[a]:t[a]);return e}r.parseOneAddress=function(e){return r(n(e,{oneResult:!0,rfc6532:!0,simple:!0,startAt:"address-list"}))},r.parseAddressList=function(e){return r(n(e,{rfc6532:!0,simple:!0,startAt:"address-list"}))},r.parseFrom=function(e){return r(n(e,{rfc6532:!0,simple:!0,startAt:"from"}))},r.parseSender=function(e){return r(n(e,{oneResult:!0,rfc6532:!0,simple:!0,startAt:"sender"}))},r.parseReplyTo=function(e){return r(n(e,{rfc6532:!0,simple:!0,startAt:"reply-to"}))},void 0!==t&&void 0!==t.exports?t.exports=r:e.emailAddresses=r}(this)},{}],36:[function(e,t,r){var n=r;n.utils=e("./hash/utils"),n.common=e("./hash/common"),n.sha=e("./hash/sha"),n.ripemd=e("./hash/ripemd"),n.hmac=e("./hash/hmac"),n.sha1=n.sha.sha1,n.sha256=n.sha.sha256,n.sha224=n.sha.sha224,n.sha384=n.sha.sha384,n.sha512=n.sha.sha512,n.ripemd160=n.ripemd.ripemd160},{"./hash/common":37,"./hash/hmac":38,"./hash/ripemd":39,"./hash/sha":40,"./hash/utils":47}],37:[function(e,t,r){"use strict";var n=e("./utils"),i=e("minimalistic-assert");function a(){this.pending=null,this.pendingTotal=0,this.blockSize=this.constructor.blockSize,this.outSize=this.constructor.outSize,this.hmacStrength=this.constructor.hmacStrength,this.padLength=this.constructor.padLength/8,this.endian="big",this._delta8=this.blockSize/8,this._delta32=this.blockSize/32}r.BlockHash=a,a.prototype.update=function(e,t){if(e=n.toArray(e,t),this.pending?this.pending=this.pending.concat(e):this.pending=e,this.pendingTotal+=e.length,this.pending.length>=this._delta8){var r=(e=this.pending).length%this._delta8;this.pending=e.slice(e.length-r,e.length),0===this.pending.length&&(this.pending=null),e=n.join32(e,0,e.length-r,this.endian);for(var i=0;i<e.length;i+=this._delta32)this._update(e,i,i+this._delta32)}return this},a.prototype.digest=function(e){return this.update(this._pad()),i(null===this.pending),this._digest(e)},a.prototype._pad=function(){var e=this.pendingTotal,t=this._delta8,r=t-(e+this.padLength)%t,n=new Array(r+this.padLength);n[0]=128;for(var i=1;i<r;i++)n[i]=0;if(e<<=3,"big"===this.endian){for(var a=8;a<this.padLength;a++)n[i++]=0;n[i++]=0,n[i++]=0,n[i++]=0,n[i++]=0,n[i++]=e>>>24&255,n[i++]=e>>>16&255,n[i++]=e>>>8&255,n[i++]=255&e}else for(n[i++]=255&e,n[i++]=e>>>8&255,n[i++]=e>>>16&255,n[i++]=e>>>24&255,n[i++]=0,n[i++]=0,n[i++]=0,n[i++]=0,a=8;a<this.padLength;a++)n[i++]=0;return n}},{"./utils":47,"minimalistic-assert":50}],38:[function(e,t,r){"use strict";var n=e("./utils"),i=e("minimalistic-assert");function a(e,t,r){if(!(this instanceof a))return new a(e,t,r);this.Hash=e,this.blockSize=e.blockSize/8,this.outSize=e.outSize/8,this.inner=null,this.outer=null,this._init(n.toArray(t,r))}t.exports=a,a.prototype._init=function(e){e.length>this.blockSize&&(e=(new this.Hash).update(e).digest()),i(e.length<=this.blockSize);for(var t=e.length;t<this.blockSize;t++)e.push(0);for(t=0;t<e.length;t++)e[t]^=54;for(this.inner=(new this.Hash).update(e),t=0;t<e.length;t++)e[t]^=106;this.outer=(new this.Hash).update(e)},a.prototype.update=function(e,t){return this.inner.update(e,t),this},a.prototype.digest=function(e){return this.outer.update(this.inner.digest()),this.outer.digest(e)}},{"./utils":47,"minimalistic-assert":50}],39:[function(e,t,r){"use strict";var n=e("./utils"),i=e("./common"),a=n.rotl32,s=n.sum32,o=n.sum32_3,u=n.sum32_4,c=i.BlockHash;function f(){if(!(this instanceof f))return new f;c.call(this),this.h=[1732584193,4023233417,2562383102,271733878,3285377520],this.endian="little"}function d(e,t,r,n){return e<=15?t^r^n:e<=31?t&r|~t&n:e<=47?(t|~r)^n:e<=63?t&n|r&~n:t^(r|~n)}function l(e){return e<=15?0:e<=31?1518500249:e<=47?1859775393:e<=63?2400959708:2840853838}function h(e){return e<=15?1352829926:e<=31?1548603684:e<=47?1836072691:e<=63?2053994217:0}n.inherits(f,c),r.ripemd160=f,f.blockSize=512,f.outSize=160,f.hmacStrength=192,f.padLength=64,f.prototype._update=function(e,t){for(var r=this.h[0],n=this.h[1],i=this.h[2],c=this.h[3],f=this.h[4],g=r,w=n,_=i,v=c,k=f,A=0;A<80;A++){var S=s(a(u(r,d(A,n,i,c),e[p[A]+t],l(A)),b[A]),f);r=f,f=c,c=a(i,10),i=n,n=S,S=s(a(u(g,d(79-A,w,_,v),e[y[A]+t],h(A)),m[A]),k),g=k,k=v,v=a(_,10),_=w,w=S}S=o(this.h[1],i,v),this.h[1]=o(this.h[2],c,k),this.h[2]=o(this.h[3],f,g),this.h[3]=o(this.h[4],r,w),this.h[4]=o(this.h[0],n,_),this.h[0]=S},f.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h,"little"):n.split32(this.h,"little")};var p=[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,7,4,13,1,10,6,15,3,12,0,9,5,2,14,11,8,3,10,14,4,9,15,8,1,2,7,0,6,13,11,5,12,1,9,11,10,0,8,12,4,13,3,7,15,14,5,6,2,4,0,5,9,7,12,2,10,14,1,3,8,11,6,15,13],y=[5,14,7,0,9,2,11,4,13,6,15,8,1,10,3,12,6,11,3,7,0,13,5,10,14,15,8,12,4,9,1,2,15,5,1,3,7,14,6,9,11,8,12,2,10,0,4,13,8,6,4,1,3,11,15,0,5,12,2,13,9,7,10,14,12,15,10,4,1,5,8,7,6,2,13,14,0,3,9,11],b=[11,14,15,12,5,8,7,9,11,13,14,15,6,7,9,8,7,6,8,13,11,9,7,15,7,12,15,9,11,7,13,12,11,13,6,7,14,9,13,15,14,8,13,6,5,12,7,5,11,12,14,15,14,15,9,8,9,14,5,6,8,6,5,12,9,15,5,11,6,8,13,12,5,12,13,14,11,8,5,6],m=[8,9,9,11,13,15,15,5,7,7,8,11,14,14,12,6,9,13,15,7,12,8,9,11,7,7,12,7,6,15,13,11,9,7,15,11,8,6,6,14,12,13,5,14,13,13,7,5,15,5,8,11,14,14,6,14,6,9,12,9,12,5,15,8,8,5,12,9,12,5,14,6,8,13,6,5,15,13,11,11]},{"./common":37,"./utils":47}],40:[function(e,t,r){"use strict";r.sha1=e("./sha/1"),r.sha224=e("./sha/224"),r.sha256=e("./sha/256"),r.sha384=e("./sha/384"),r.sha512=e("./sha/512")},{"./sha/1":41,"./sha/224":42,"./sha/256":43,"./sha/384":44,"./sha/512":45}],41:[function(e,t,r){"use strict";var n=e("../utils"),i=e("../common"),a=e("./common"),s=n.rotl32,o=n.sum32,u=n.sum32_5,c=a.ft_1,f=i.BlockHash,d=[1518500249,1859775393,2400959708,3395469782];function l(){if(!(this instanceof l))return new l;f.call(this),this.h=[1732584193,4023233417,2562383102,271733878,3285377520],this.W=new Array(80)}n.inherits(l,f),t.exports=l,l.blockSize=512,l.outSize=160,l.hmacStrength=80,l.padLength=64,l.prototype._update=function(e,t){for(var r=this.W,n=0;n<16;n++)r[n]=e[t+n];for(;n<r.length;n++)r[n]=s(r[n-3]^r[n-8]^r[n-14]^r[n-16],1);var i=this.h[0],a=this.h[1],f=this.h[2],l=this.h[3],h=this.h[4];for(n=0;n<r.length;n++){var p=~~(n/20),y=u(s(i,5),c(p,a,f,l),h,r[n],d[p]);h=l,l=f,f=s(a,30),a=i,i=y}this.h[0]=o(this.h[0],i),this.h[1]=o(this.h[1],a),this.h[2]=o(this.h[2],f),this.h[3]=o(this.h[3],l),this.h[4]=o(this.h[4],h)},l.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h,"big"):n.split32(this.h,"big")}},{"../common":37,"../utils":47,"./common":46}],42:[function(e,t,r){"use strict";var n=e("../utils"),i=e("./256");function a(){if(!(this instanceof a))return new a;i.call(this),this.h=[3238371032,914150663,812702999,4144912697,4290775857,1750603025,1694076839,3204075428]}n.inherits(a,i),t.exports=a,a.blockSize=512,a.outSize=224,a.hmacStrength=192,a.padLength=64,a.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h.slice(0,7),"big"):n.split32(this.h.slice(0,7),"big")}},{"../utils":47,"./256":43}],43:[function(e,t,r){"use strict";var n=e("../utils"),i=e("../common"),a=e("./common"),s=e("minimalistic-assert"),o=n.sum32,u=n.sum32_4,c=n.sum32_5,f=a.ch32,d=a.maj32,l=a.s0_256,h=a.s1_256,p=a.g0_256,y=a.g1_256,b=i.BlockHash,m=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];function g(){if(!(this instanceof g))return new g;b.call(this),this.h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],this.k=m,this.W=new Array(64)}n.inherits(g,b),t.exports=g,g.blockSize=512,g.outSize=256,g.hmacStrength=192,g.padLength=64,g.prototype._update=function(e,t){for(var r=this.W,n=0;n<16;n++)r[n]=e[t+n];for(;n<r.length;n++)r[n]=u(y(r[n-2]),r[n-7],p(r[n-15]),r[n-16]);var i=this.h[0],a=this.h[1],b=this.h[2],m=this.h[3],g=this.h[4],w=this.h[5],_=this.h[6],v=this.h[7];for(s(this.k.length===r.length),n=0;n<r.length;n++){var k=c(v,h(g),f(g,w,_),this.k[n],r[n]),A=o(l(i),d(i,a,b));v=_,_=w,w=g,g=o(m,k),m=b,b=a,a=i,i=o(k,A)}this.h[0]=o(this.h[0],i),this.h[1]=o(this.h[1],a),this.h[2]=o(this.h[2],b),this.h[3]=o(this.h[3],m),this.h[4]=o(this.h[4],g),this.h[5]=o(this.h[5],w),this.h[6]=o(this.h[6],_),this.h[7]=o(this.h[7],v)},g.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h,"big"):n.split32(this.h,"big")}},{"../common":37,"../utils":47,"./common":46,"minimalistic-assert":50}],44:[function(e,t,r){"use strict";var n=e("../utils"),i=e("./512");function a(){if(!(this instanceof a))return new a;i.call(this),this.h=[3418070365,3238371032,1654270250,914150663,2438529370,812702999,355462360,4144912697,1731405415,4290775857,2394180231,1750603025,3675008525,1694076839,1203062813,3204075428]}n.inherits(a,i),t.exports=a,a.blockSize=1024,a.outSize=384,a.hmacStrength=192,a.padLength=128,a.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h.slice(0,12),"big"):n.split32(this.h.slice(0,12),"big")}},{"../utils":47,"./512":45}],45:[function(e,t,r){"use strict";var n=e("../utils"),i=e("../common"),a=e("minimalistic-assert"),s=n.rotr64_hi,o=n.rotr64_lo,u=n.shr64_hi,c=n.shr64_lo,f=n.sum64,d=n.sum64_hi,l=n.sum64_lo,h=n.sum64_4_hi,p=n.sum64_4_lo,y=n.sum64_5_hi,b=n.sum64_5_lo,m=i.BlockHash,g=[1116352408,3609767458,1899447441,602891725,3049323471,3964484399,3921009573,2173295548,961987163,4081628472,1508970993,3053834265,2453635748,2937671579,2870763221,3664609560,3624381080,2734883394,310598401,1164996542,607225278,1323610764,1426881987,3590304994,1925078388,4068182383,2162078206,991336113,2614888103,633803317,3248222580,3479774868,3835390401,2666613458,4022224774,944711139,264347078,2341262773,604807628,2007800933,770255983,1495990901,1249150122,1856431235,1555081692,3175218132,1996064986,2198950837,2554220882,3999719339,2821834349,766784016,2952996808,2566594879,3210313671,3203337956,3336571891,1034457026,3584528711,2466948901,113926993,3758326383,338241895,168717936,666307205,1188179964,773529912,1546045734,1294757372,1522805485,1396182291,2643833823,1695183700,2343527390,1986661051,1014477480,2177026350,1206759142,2456956037,344077627,2730485921,1290863460,2820302411,3158454273,3259730800,3505952657,3345764771,106217008,3516065817,3606008344,3600352804,1432725776,4094571909,1467031594,275423344,851169720,430227734,3100823752,506948616,1363258195,659060556,3750685593,883997877,3785050280,958139571,3318307427,1322822218,3812723403,1537002063,2003034995,1747873779,3602036899,1955562222,1575990012,2024104815,1125592928,2227730452,2716904306,2361852424,442776044,2428436474,593698344,2756734187,3733110249,3204031479,2999351573,3329325298,3815920427,3391569614,3928383900,3515267271,566280711,3940187606,3454069534,4118630271,4000239992,116418474,1914138554,174292421,2731055270,289380356,3203993006,460393269,320620315,685471733,587496836,852142971,1086792851,1017036298,365543100,1126000580,2618297676,1288033470,3409855158,1501505948,4234509866,1607167915,987167468,1816402316,1246189591];function w(){if(!(this instanceof w))return new w;m.call(this),this.h=[1779033703,4089235720,3144134277,2227873595,1013904242,4271175723,2773480762,1595750129,1359893119,2917565137,2600822924,725511199,528734635,4215389547,1541459225,327033209],this.k=g,this.W=new Array(160)}function _(e,t,r,n,i){var a=e&r^~e&i;return a<0&&(a+=4294967296),a}function v(e,t,r,n,i,a){var s=t&n^~t&a;return s<0&&(s+=4294967296),s}function k(e,t,r,n,i){var a=e&r^e&i^r&i;return a<0&&(a+=4294967296),a}function A(e,t,r,n,i,a){var s=t&n^t&a^n&a;return s<0&&(s+=4294967296),s}function S(e,t){var r=s(e,t,28)^s(t,e,2)^s(t,e,7);return r<0&&(r+=4294967296),r}function E(e,t){var r=o(e,t,28)^o(t,e,2)^o(t,e,7);return r<0&&(r+=4294967296),r}function P(e,t){var r=s(e,t,14)^s(e,t,18)^s(t,e,9);return r<0&&(r+=4294967296),r}function x(e,t){var r=o(e,t,14)^o(e,t,18)^o(t,e,9);return r<0&&(r+=4294967296),r}function M(e,t){var r=s(e,t,1)^s(e,t,8)^u(e,t,7);return r<0&&(r+=4294967296),r}function C(e,t){var r=o(e,t,1)^o(e,t,8)^c(e,t,7);return r<0&&(r+=4294967296),r}function j(e,t){var r=s(e,t,19)^s(t,e,29)^u(e,t,6);return r<0&&(r+=4294967296),r}function R(e,t){var r=o(e,t,19)^o(t,e,29)^c(e,t,6);return r<0&&(r+=4294967296),r}n.inherits(w,m),t.exports=w,w.blockSize=1024,w.outSize=512,w.hmacStrength=192,w.padLength=128,w.prototype._prepareBlock=function(e,t){for(var r=this.W,n=0;n<32;n++)r[n]=e[t+n];for(;n<r.length;n+=2){var i=j(r[n-4],r[n-3]),a=R(r[n-4],r[n-3]),s=r[n-14],o=r[n-13],u=M(r[n-30],r[n-29]),c=C(r[n-30],r[n-29]),f=r[n-32],d=r[n-31];r[n]=h(i,a,s,o,u,c,f,d),r[n+1]=p(i,a,s,o,u,c,f,d)}},w.prototype._update=function(e,t){this._prepareBlock(e,t);var r=this.W,n=this.h[0],i=this.h[1],s=this.h[2],o=this.h[3],u=this.h[4],c=this.h[5],h=this.h[6],p=this.h[7],m=this.h[8],g=this.h[9],w=this.h[10],M=this.h[11],C=this.h[12],j=this.h[13],R=this.h[14],B=this.h[15];a(this.k.length===r.length);for(var K=0;K<r.length;K+=2){var I=R,U=B,T=P(m,g),z=x(m,g),O=_(m,g,w,M,C),D=v(m,g,w,M,C,j),N=this.k[K],q=this.k[K+1],F=r[K],L=r[K+1],W=y(I,U,T,z,O,D,N,q,F,L),H=b(I,U,T,z,O,D,N,q,F,L);I=S(n,i),U=E(n,i),T=k(n,i,s,o,u),z=A(n,i,s,o,u,c);var Z=d(I,U,T,z),G=l(I,U,T,z);R=C,B=j,C=w,j=M,w=m,M=g,m=d(h,p,W,H),g=l(p,p,W,H),h=u,p=c,u=s,c=o,s=n,o=i,n=d(W,H,Z,G),i=l(W,H,Z,G)}f(this.h,0,n,i),f(this.h,2,s,o),f(this.h,4,u,c),f(this.h,6,h,p),f(this.h,8,m,g),f(this.h,10,w,M),f(this.h,12,C,j),f(this.h,14,R,B)},w.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h,"big"):n.split32(this.h,"big")}},{"../common":37,"../utils":47,"minimalistic-assert":50}],46:[function(e,t,r){"use strict";var n=e("../utils").rotr32;function i(e,t,r){return e&t^~e&r}function a(e,t,r){return e&t^e&r^t&r}function s(e,t,r){return e^t^r}r.ft_1=function(e,t,r,n){return 0===e?i(t,r,n):1===e||3===e?s(t,r,n):2===e?a(t,r,n):void 0},r.ch32=i,r.maj32=a,r.p32=s,r.s0_256=function(e){return n(e,2)^n(e,13)^n(e,22)},r.s1_256=function(e){return n(e,6)^n(e,11)^n(e,25)},r.g0_256=function(e){return n(e,7)^n(e,18)^e>>>3},r.g1_256=function(e){return n(e,17)^n(e,19)^e>>>10}},{"../utils":47}],47:[function(e,t,r){"use strict";var n=e("minimalistic-assert"),i=e("inherits");function a(e){return(e>>>24|e>>>8&65280|e<<8&16711680|(255&e)<<24)>>>0}function s(e){return 1===e.length?"0"+e:e}function o(e){return 7===e.length?"0"+e:6===e.length?"00"+e:5===e.length?"000"+e:4===e.length?"0000"+e:3===e.length?"00000"+e:2===e.length?"000000"+e:1===e.length?"0000000"+e:e}r.inherits=i,r.toArray=function(e,t){if(Array.isArray(e))return e.slice();if(!e)return[];var r=[];if("string"==typeof e)if(t){if("hex"===t)for((e=e.replace(/[^a-z0-9]+/gi,"")).length%2!=0&&(e="0"+e),n=0;n<e.length;n+=2)r.push(parseInt(e[n]+e[n+1],16))}else for(var n=0;n<e.length;n++){var i=e.charCodeAt(n),a=i>>8,s=255&i;a?r.push(a,s):r.push(s)}else for(n=0;n<e.length;n++)r[n]=0|e[n];return r},r.toHex=function(e){for(var t="",r=0;r<e.length;r++)t+=s(e[r].toString(16));return t},r.htonl=a,r.toHex32=function(e,t){for(var r="",n=0;n<e.length;n++){var i=e[n];"little"===t&&(i=a(i)),r+=o(i.toString(16))}return r},r.zero2=s,r.zero8=o,r.join32=function(e,t,r,i){var a=r-t;n(a%4==0);for(var s=new Array(a/4),o=0,u=t;o<s.length;o++,u+=4){var c;c="big"===i?e[u]<<24|e[u+1]<<16|e[u+2]<<8|e[u+3]:e[u+3]<<24|e[u+2]<<16|e[u+1]<<8|e[u],s[o]=c>>>0}return s},r.split32=function(e,t){for(var r=new Array(4*e.length),n=0,i=0;n<e.length;n++,i+=4){var a=e[n];"big"===t?(r[i]=a>>>24,r[i+1]=a>>>16&255,r[i+2]=a>>>8&255,r[i+3]=255&a):(r[i+3]=a>>>24,r[i+2]=a>>>16&255,r[i+1]=a>>>8&255,r[i]=255&a)}return r},r.rotr32=function(e,t){return e>>>t|e<<32-t},r.rotl32=function(e,t){return e<<t|e>>>32-t},r.sum32=function(e,t){return e+t>>>0},r.sum32_3=function(e,t,r){return e+t+r>>>0},r.sum32_4=function(e,t,r,n){return e+t+r+n>>>0},r.sum32_5=function(e,t,r,n,i){return e+t+r+n+i>>>0},r.sum64=function(e,t,r,n){var i=e[t],a=n+e[t+1]>>>0,s=(a<n?1:0)+r+i;e[t]=s>>>0,e[t+1]=a},r.sum64_hi=function(e,t,r,n){return(t+n>>>0<t?1:0)+e+r>>>0},r.sum64_lo=function(e,t,r,n){return t+n>>>0},r.sum64_4_hi=function(e,t,r,n,i,a,s,o){var u=0,c=t;return u+=(c=c+n>>>0)<t?1:0,u+=(c=c+a>>>0)<a?1:0,e+r+i+s+(u+=(c=c+o>>>0)<o?1:0)>>>0},r.sum64_4_lo=function(e,t,r,n,i,a,s,o){return t+n+a+o>>>0},r.sum64_5_hi=function(e,t,r,n,i,a,s,o,u,c){var f=0,d=t;return f+=(d=d+n>>>0)<t?1:0,f+=(d=d+a>>>0)<a?1:0,f+=(d=d+o>>>0)<o?1:0,e+r+i+s+u+(f+=(d=d+c>>>0)<c?1:0)>>>0},r.sum64_5_lo=function(e,t,r,n,i,a,s,o,u,c){return t+n+a+o+c>>>0},r.rotr64_hi=function(e,t,r){return(t<<32-r|e>>>r)>>>0},r.rotr64_lo=function(e,t,r){return(e<<32-r|t>>>r)>>>0},r.shr64_hi=function(e,t,r){return e>>>r},r.shr64_lo=function(e,t,r){return(e<<32-r|t>>>r)>>>0}},{inherits:49,"minimalistic-assert":50}],48:[function(e,t,r){"use strict";var n=e("hash.js"),i=e("minimalistic-crypto-utils"),a=e("minimalistic-assert");function s(e){if(!(this instanceof s))return new s(e);this.hash=e.hash,this.predResist=!!e.predResist,this.outLen=this.hash.outSize,this.minEntropy=e.minEntropy||this.hash.hmacStrength,this._reseed=null,this.reseedInterval=null,this.K=null,this.V=null;var t=i.toArray(e.entropy,e.entropyEnc||"hex"),r=i.toArray(e.nonce,e.nonceEnc||"hex"),n=i.toArray(e.pers,e.persEnc||"hex");a(t.length>=this.minEntropy/8,"Not enough entropy. Minimum is: "+this.minEntropy+" bits"),this._init(t,r,n)}t.exports=s,s.prototype._init=function(e,t,r){var n=e.concat(t).concat(r);this.K=new Array(this.outLen/8),this.V=new Array(this.outLen/8);for(var i=0;i<this.V.length;i++)this.K[i]=0,this.V[i]=1;this._update(n),this._reseed=1,this.reseedInterval=281474976710656},s.prototype._hmac=function(){return new n.hmac(this.hash,this.K)},s.prototype._update=function(e){var t=this._hmac().update(this.V).update([0]);e&&(t=t.update(e)),this.K=t.digest(),this.V=this._hmac().update(this.V).digest(),e&&(this.K=this._hmac().update(this.V).update([1]).update(e).digest(),this.V=this._hmac().update(this.V).digest())},s.prototype.reseed=function(e,t,r,n){"string"!=typeof t&&(n=r,r=t,t=null),e=i.toArray(e,t),r=i.toArray(r,n),a(e.length>=this.minEntropy/8,"Not enough entropy. Minimum is: "+this.minEntropy+" bits"),this._update(e.concat(r||[])),this._reseed=1},s.prototype.generate=function(e,t,r,n){if(this._reseed>this.reseedInterval)throw new Error("Reseed is required");"string"!=typeof t&&(n=r,r=t,t=null),r&&(r=i.toArray(r,n||"hex"),this._update(r));for(var a=[];a.length<e;)this.V=this._hmac().update(this.V).digest(),a=a.concat(this.V);var s=a.slice(0,e);return this._update(r),this._reseed++,i.encode(s,t)}},{"hash.js":36,"minimalistic-assert":50,"minimalistic-crypto-utils":51}],49:[function(e,t,r){"function"==typeof Object.create?t.exports=function(e,t){e.super_=t,e.prototype=Object.create(t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}})}:t.exports=function(e,t){e.super_=t;var r=function(){};r.prototype=t.prototype,e.prototype=new r,e.prototype.constructor=e}},{}],50:[function(e,t,r){function n(e,t){if(!e)throw new Error(t||"Assertion failed")}t.exports=n,n.equal=function(e,t,r){if(e!=t)throw new Error(r||"Assertion failed: "+e+" != "+t)}},{}],51:[function(e,t,r){"use strict";var n=r;function i(e){return 1===e.length?"0"+e:e}function a(e){for(var t="",r=0;r<e.length;r++)t+=i(e[r].toString(16));return t}n.toArray=function(e,t){if(Array.isArray(e))return e.slice();if(!e)return[];var r=[];if("string"!=typeof e){for(var n=0;n<e.length;n++)r[n]=0|e[n];return r}if("hex"===t)for((e=e.replace(/[^a-z0-9]+/gi,"")).length%2!=0&&(e="0"+e),n=0;n<e.length;n+=2)r.push(parseInt(e[n]+e[n+1],16));else for(n=0;n<e.length;n++){var i=e.charCodeAt(n),a=i>>8,s=255&i;a?r.push(a,s):r.push(s)}return r},n.zero2=i,n.toHex=a,n.encode=function(e,t){return"hex"===t?a(e):e}},{}],52:[function(e,t,r){"use strict";var n={};(0,e("./lib/utils/common").assign)(n,e("./lib/deflate"),e("./lib/inflate"),e("./lib/zlib/constants")),t.exports=n},{"./lib/deflate":53,"./lib/inflate":54,"./lib/utils/common":55,"./lib/zlib/constants":58}],53:[function(e,t,r){"use strict";var n=e("./zlib/deflate"),i=e("./utils/common"),a=e("./utils/strings"),s=e("./zlib/messages"),o=e("./zlib/zstream"),u=Object.prototype.toString,c=0,f=-1,d=0,l=8;function h(e){if(!(this instanceof h))return new h(e);this.options=i.assign({level:f,method:l,chunkSize:16384,windowBits:15,memLevel:8,strategy:d,to:""},e||{});var t=this.options;t.raw&&t.windowBits>0?t.windowBits=-t.windowBits:t.gzip&&t.windowBits>0&&t.windowBits<16&&(t.windowBits+=16),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new o,this.strm.avail_out=0;var r=n.deflateInit2(this.strm,t.level,t.method,t.windowBits,t.memLevel,t.strategy);if(r!==c)throw new Error(s[r]);if(t.header&&n.deflateSetHeader(this.strm,t.header),t.dictionary){var p;if(p="string"==typeof t.dictionary?a.string2buf(t.dictionary):"[object ArrayBuffer]"===u.call(t.dictionary)?new Uint8Array(t.dictionary):t.dictionary,(r=n.deflateSetDictionary(this.strm,p))!==c)throw new Error(s[r]);this._dict_set=!0}}function p(e,t){var r=new h(t);if(r.push(e,!0),r.err)throw r.msg||s[r.err];return r.result}h.prototype.push=function(e,t){var r,s,o=this.strm,f=this.options.chunkSize;if(this.ended)return!1;s=t===~~t?t:!0===t?4:0,"string"==typeof e?o.input=a.string2buf(e):"[object ArrayBuffer]"===u.call(e)?o.input=new Uint8Array(e):o.input=e,o.next_in=0,o.avail_in=o.input.length;do{if(0===o.avail_out&&(o.output=new i.Buf8(f),o.next_out=0,o.avail_out=f),1!==(r=n.deflate(o,s))&&r!==c)return this.onEnd(r),this.ended=!0,!1;0!==o.avail_out&&(0!==o.avail_in||4!==s&&2!==s)||("string"===this.options.to?this.onData(a.buf2binstring(i.shrinkBuf(o.output,o.next_out))):this.onData(i.shrinkBuf(o.output,o.next_out)))}while((o.avail_in>0||0===o.avail_out)&&1!==r);return 4===s?(r=n.deflateEnd(this.strm),this.onEnd(r),this.ended=!0,r===c):2!==s||(this.onEnd(c),o.avail_out=0,!0)},h.prototype.onData=function(e){this.chunks.push(e)},h.prototype.onEnd=function(e){e===c&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=i.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},r.Deflate=h,r.deflate=p,r.deflateRaw=function(e,t){return(t=t||{}).raw=!0,p(e,t)},r.gzip=function(e,t){return(t=t||{}).gzip=!0,p(e,t)}},{"./utils/common":55,"./utils/strings":56,"./zlib/deflate":60,"./zlib/messages":65,"./zlib/zstream":67}],54:[function(e,t,r){"use strict";var n=e("./zlib/inflate"),i=e("./utils/common"),a=e("./utils/strings"),s=e("./zlib/constants"),o=e("./zlib/messages"),u=e("./zlib/zstream"),c=e("./zlib/gzheader"),f=Object.prototype.toString;function d(e){if(!(this instanceof d))return new d(e);this.options=i.assign({chunkSize:16384,windowBits:0,to:""},e||{});var t=this.options;t.raw&&t.windowBits>=0&&t.windowBits<16&&(t.windowBits=-t.windowBits,0===t.windowBits&&(t.windowBits=-15)),!(t.windowBits>=0&&t.windowBits<16)||e&&e.windowBits||(t.windowBits+=32),t.windowBits>15&&t.windowBits<48&&0==(15&t.windowBits)&&(t.windowBits|=15),this.err=0,this.msg="",this.ended=!1,this.chunks=[],this.strm=new u,this.strm.avail_out=0;var r=n.inflateInit2(this.strm,t.windowBits);if(r!==s.Z_OK)throw new Error(o[r]);this.header=new c,n.inflateGetHeader(this.strm,this.header)}function l(e,t){var r=new d(t);if(r.push(e,!0),r.err)throw r.msg||o[r.err];return r.result}d.prototype.push=function(e,t){var r,o,u,c,d,l,h=this.strm,p=this.options.chunkSize,y=this.options.dictionary,b=!1;if(this.ended)return!1;o=t===~~t?t:!0===t?s.Z_FINISH:s.Z_NO_FLUSH,"string"==typeof e?h.input=a.binstring2buf(e):"[object ArrayBuffer]"===f.call(e)?h.input=new Uint8Array(e):h.input=e,h.next_in=0,h.avail_in=h.input.length;do{if(0===h.avail_out&&(h.output=new i.Buf8(p),h.next_out=0,h.avail_out=p),(r=n.inflate(h,s.Z_NO_FLUSH))===s.Z_NEED_DICT&&y&&(l="string"==typeof y?a.string2buf(y):"[object ArrayBuffer]"===f.call(y)?new Uint8Array(y):y,r=n.inflateSetDictionary(this.strm,l)),r===s.Z_BUF_ERROR&&!0===b&&(r=s.Z_OK,b=!1),r!==s.Z_STREAM_END&&r!==s.Z_OK)return this.onEnd(r),this.ended=!0,!1;h.next_out&&(0!==h.avail_out&&r!==s.Z_STREAM_END&&(0!==h.avail_in||o!==s.Z_FINISH&&o!==s.Z_SYNC_FLUSH)||("string"===this.options.to?(u=a.utf8border(h.output,h.next_out),c=h.next_out-u,d=a.buf2string(h.output,u),h.next_out=c,h.avail_out=p-c,c&&i.arraySet(h.output,h.output,u,c,0),this.onData(d)):this.onData(i.shrinkBuf(h.output,h.next_out)))),0===h.avail_in&&0===h.avail_out&&(b=!0)}while((h.avail_in>0||0===h.avail_out)&&r!==s.Z_STREAM_END);return r===s.Z_STREAM_END&&(o=s.Z_FINISH),o===s.Z_FINISH?(r=n.inflateEnd(this.strm),this.onEnd(r),this.ended=!0,r===s.Z_OK):o!==s.Z_SYNC_FLUSH||(this.onEnd(s.Z_OK),h.avail_out=0,!0)},d.prototype.onData=function(e){this.chunks.push(e)},d.prototype.onEnd=function(e){e===s.Z_OK&&("string"===this.options.to?this.result=this.chunks.join(""):this.result=i.flattenChunks(this.chunks)),this.chunks=[],this.err=e,this.msg=this.strm.msg},r.Inflate=d,r.inflate=l,r.inflateRaw=function(e,t){return(t=t||{}).raw=!0,l(e,t)},r.ungzip=l},{"./utils/common":55,"./utils/strings":56,"./zlib/constants":58,"./zlib/gzheader":61,"./zlib/inflate":63,"./zlib/messages":65,"./zlib/zstream":67}],55:[function(e,t,r){"use strict";var n="undefined"!=typeof Uint8Array&&"undefined"!=typeof Uint16Array&&"undefined"!=typeof Int32Array;function i(e,t){return Object.prototype.hasOwnProperty.call(e,t)}r.assign=function(e){for(var t=Array.prototype.slice.call(arguments,1);t.length;){var r=t.shift();if(r){if("object"!=typeof r)throw new TypeError(r+"must be non-object");for(var n in r)i(r,n)&&(e[n]=r[n])}}return e},r.shrinkBuf=function(e,t){return e.length===t?e:e.subarray?e.subarray(0,t):(e.length=t,e)};var a={arraySet:function(e,t,r,n,i){if(t.subarray&&e.subarray)e.set(t.subarray(r,r+n),i);else for(var a=0;a<n;a++)e[i+a]=t[r+a]},flattenChunks:function(e){var t,r,n,i,a,s;for(n=0,t=0,r=e.length;t<r;t++)n+=e[t].length;for(s=new Uint8Array(n),i=0,t=0,r=e.length;t<r;t++)a=e[t],s.set(a,i),i+=a.length;return s}},s={arraySet:function(e,t,r,n,i){for(var a=0;a<n;a++)e[i+a]=t[r+a]},flattenChunks:function(e){return[].concat.apply([],e)}};r.setTyped=function(e){e?(r.Buf8=Uint8Array,r.Buf16=Uint16Array,r.Buf32=Int32Array,r.assign(r,a)):(r.Buf8=Array,r.Buf16=Array,r.Buf32=Array,r.assign(r,s))},r.setTyped(n)},{}],56:[function(e,t,r){"use strict";var n=e("./common"),i=!0,a=!0;try{String.fromCharCode.apply(null,[0])}catch(c){i=!1}try{String.fromCharCode.apply(null,new Uint8Array(1))}catch(c){a=!1}for(var s=new n.Buf8(256),o=0;o<256;o++)s[o]=o>=252?6:o>=248?5:o>=240?4:o>=224?3:o>=192?2:1;function u(e,t){if(t<65537&&(e.subarray&&a||!e.subarray&&i))return String.fromCharCode.apply(null,n.shrinkBuf(e,t));for(var r="",s=0;s<t;s++)r+=String.fromCharCode(e[s]);return r}s[254]=s[254]=1,r.string2buf=function(e){var t,r,i,a,s,o=e.length,u=0;for(a=0;a<o;a++)55296==(64512&(r=e.charCodeAt(a)))&&a+1<o&&56320==(64512&(i=e.charCodeAt(a+1)))&&(r=65536+(r-55296<<10)+(i-56320),a++),u+=r<128?1:r<2048?2:r<65536?3:4;for(t=new n.Buf8(u),s=0,a=0;s<u;a++)55296==(64512&(r=e.charCodeAt(a)))&&a+1<o&&56320==(64512&(i=e.charCodeAt(a+1)))&&(r=65536+(r-55296<<10)+(i-56320),a++),r<128?t[s++]=r:r<2048?(t[s++]=192|r>>>6,t[s++]=128|63&r):r<65536?(t[s++]=224|r>>>12,t[s++]=128|r>>>6&63,t[s++]=128|63&r):(t[s++]=240|r>>>18,t[s++]=128|r>>>12&63,t[s++]=128|r>>>6&63,t[s++]=128|63&r);return t},r.buf2binstring=function(e){return u(e,e.length)},r.binstring2buf=function(e){for(var t=new n.Buf8(e.length),r=0,i=t.length;r<i;r++)t[r]=e.charCodeAt(r);return t},r.buf2string=function(e,t){var r,n,i,a,o=t||e.length,c=new Array(2*o);for(n=0,r=0;r<o;)if((i=e[r++])<128)c[n++]=i;else if((a=s[i])>4)c[n++]=65533,r+=a-1;else{for(i&=2===a?31:3===a?15:7;a>1&&r<o;)i=i<<6|63&e[r++],a--;a>1?c[n++]=65533:i<65536?c[n++]=i:(i-=65536,c[n++]=55296|i>>10&1023,c[n++]=56320|1023&i)}return u(c,n)},r.utf8border=function(e,t){var r;for((t=t||e.length)>e.length&&(t=e.length),r=t-1;r>=0&&128==(192&e[r]);)r--;return r<0?t:0===r?t:r+s[e[r]]>t?r:t}},{"./common":55}],57:[function(e,t,r){"use strict";t.exports=function(e,t,r,n){for(var i=65535&e|0,a=e>>>16&65535|0,s=0;0!==r;){r-=s=r>2e3?2e3:r;do{a=a+(i=i+t[n++]|0)|0}while(--s);i%=65521,a%=65521}return i|a<<16|0}},{}],58:[function(e,t,r){"use strict";t.exports={Z_NO_FLUSH:0,Z_PARTIAL_FLUSH:1,Z_SYNC_FLUSH:2,Z_FULL_FLUSH:3,Z_FINISH:4,Z_BLOCK:5,Z_TREES:6,Z_OK:0,Z_STREAM_END:1,Z_NEED_DICT:2,Z_ERRNO:-1,Z_STREAM_ERROR:-2,Z_DATA_ERROR:-3,Z_BUF_ERROR:-5,Z_NO_COMPRESSION:0,Z_BEST_SPEED:1,Z_BEST_COMPRESSION:9,Z_DEFAULT_COMPRESSION:-1,Z_FILTERED:1,Z_HUFFMAN_ONLY:2,Z_RLE:3,Z_FIXED:4,Z_DEFAULT_STRATEGY:0,Z_BINARY:0,Z_TEXT:1,Z_UNKNOWN:2,Z_DEFLATED:8}},{}],59:[function(e,t,r){"use strict";var n=function(){for(var e,t=[],r=0;r<256;r++){e=r;for(var n=0;n<8;n++)e=1&e?3988292384^e>>>1:e>>>1;t[r]=e}return t}();t.exports=function(e,t,r,i){var a=n,s=i+r;e^=-1;for(var o=i;o<s;o++)e=e>>>8^a[255&(e^t[o])];return-1^e}},{}],60:[function(e,t,r){"use strict";var n,i=e("../utils/common"),a=e("./trees"),s=e("./adler32"),o=e("./crc32"),u=e("./messages"),c=0,f=1,d=3,l=4,h=5,p=0,y=1,b=-2,m=-3,g=-5,w=-1,_=1,v=2,k=3,A=4,S=0,E=2,P=8,x=9,M=15,C=8,j=286,R=30,B=19,K=2*j+1,I=15,U=3,T=258,z=T+U+1,O=32,D=42,N=69,q=73,F=91,L=103,W=113,H=666,Z=1,G=2,V=3,Y=4,X=3;function $(e,t){return e.msg=u[t],t}function J(e){return(e<<1)-(e>4?9:0)}function Q(e){for(var t=e.length;--t>=0;)e[t]=0}function ee(e){var t=e.state,r=t.pending;r>e.avail_out&&(r=e.avail_out),0!==r&&(i.arraySet(e.output,t.pending_buf,t.pending_out,r,e.next_out),e.next_out+=r,t.pending_out+=r,e.total_out+=r,e.avail_out-=r,t.pending-=r,0===t.pending&&(t.pending_out=0))}function te(e,t){a._tr_flush_block(e,e.block_start>=0?e.block_start:-1,e.strstart-e.block_start,t),e.block_start=e.strstart,ee(e.strm)}function re(e,t){e.pending_buf[e.pending++]=t}function ne(e,t){e.pending_buf[e.pending++]=t>>>8&255,e.pending_buf[e.pending++]=255&t}function ie(e,t){var r,n,i=e.max_chain_length,a=e.strstart,s=e.prev_length,o=e.nice_match,u=e.strstart>e.w_size-z?e.strstart-(e.w_size-z):0,c=e.window,f=e.w_mask,d=e.prev,l=e.strstart+T,h=c[a+s-1],p=c[a+s];e.prev_length>=e.good_match&&(i>>=2),o>e.lookahead&&(o=e.lookahead);do{if(c[(r=t)+s]===p&&c[r+s-1]===h&&c[r]===c[a]&&c[++r]===c[a+1]){a+=2,r++;do{}while(c[++a]===c[++r]&&c[++a]===c[++r]&&c[++a]===c[++r]&&c[++a]===c[++r]&&c[++a]===c[++r]&&c[++a]===c[++r]&&c[++a]===c[++r]&&c[++a]===c[++r]&&a<l);if(n=T-(l-a),a=l-T,n>s){if(e.match_start=t,s=n,n>=o)break;h=c[a+s-1],p=c[a+s]}}}while((t=d[t&f])>u&&0!=--i);return s<=e.lookahead?s:e.lookahead}function ae(e){var t,r,n,a,u,c,f,d,l,h,p=e.w_size;do{if(a=e.window_size-e.lookahead-e.strstart,e.strstart>=p+(p-z)){i.arraySet(e.window,e.window,p,p,0),e.match_start-=p,e.strstart-=p,e.block_start-=p,t=r=e.hash_size;do{n=e.head[--t],e.head[t]=n>=p?n-p:0}while(--r);t=r=p;do{n=e.prev[--t],e.prev[t]=n>=p?n-p:0}while(--r);a+=p}if(0===e.strm.avail_in)break;if(c=e.strm,f=e.window,d=e.strstart+e.lookahead,l=a,h=void 0,(h=c.avail_in)>l&&(h=l),r=0===h?0:(c.avail_in-=h,i.arraySet(f,c.input,c.next_in,h,d),1===c.state.wrap?c.adler=s(c.adler,f,h,d):2===c.state.wrap&&(c.adler=o(c.adler,f,h,d)),c.next_in+=h,c.total_in+=h,h),e.lookahead+=r,e.lookahead+e.insert>=U)for(u=e.strstart-e.insert,e.ins_h=e.window[u],e.ins_h=(e.ins_h<<e.hash_shift^e.window[u+1])&e.hash_mask;e.insert&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[u+U-1])&e.hash_mask,e.prev[u&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=u,u++,e.insert--,!(e.lookahead+e.insert<U)););}while(e.lookahead<z&&0!==e.strm.avail_in)}function se(e,t){for(var r,n;;){if(e.lookahead<z){if(ae(e),e.lookahead<z&&t===c)return Z;if(0===e.lookahead)break}if(r=0,e.lookahead>=U&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+U-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),0!==r&&e.strstart-r<=e.w_size-z&&(e.match_length=ie(e,r)),e.match_length>=U)if(n=a._tr_tally(e,e.strstart-e.match_start,e.match_length-U),e.lookahead-=e.match_length,e.match_length<=e.max_lazy_match&&e.lookahead>=U){e.match_length--;do{e.strstart++,e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+U-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart}while(0!=--e.match_length);e.strstart++}else e.strstart+=e.match_length,e.match_length=0,e.ins_h=e.window[e.strstart],e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+1])&e.hash_mask;else n=a._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++;if(n&&(te(e,!1),0===e.strm.avail_out))return Z}return e.insert=e.strstart<U-1?e.strstart:U-1,t===l?(te(e,!0),0===e.strm.avail_out?V:Y):e.last_lit&&(te(e,!1),0===e.strm.avail_out)?Z:G}function oe(e,t){for(var r,n,i;;){if(e.lookahead<z){if(ae(e),e.lookahead<z&&t===c)return Z;if(0===e.lookahead)break}if(r=0,e.lookahead>=U&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+U-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart),e.prev_length=e.match_length,e.prev_match=e.match_start,e.match_length=U-1,0!==r&&e.prev_length<e.max_lazy_match&&e.strstart-r<=e.w_size-z&&(e.match_length=ie(e,r),e.match_length<=5&&(e.strategy===_||e.match_length===U&&e.strstart-e.match_start>4096)&&(e.match_length=U-1)),e.prev_length>=U&&e.match_length<=e.prev_length){i=e.strstart+e.lookahead-U,n=a._tr_tally(e,e.strstart-1-e.prev_match,e.prev_length-U),e.lookahead-=e.prev_length-1,e.prev_length-=2;do{++e.strstart<=i&&(e.ins_h=(e.ins_h<<e.hash_shift^e.window[e.strstart+U-1])&e.hash_mask,r=e.prev[e.strstart&e.w_mask]=e.head[e.ins_h],e.head[e.ins_h]=e.strstart)}while(0!=--e.prev_length);if(e.match_available=0,e.match_length=U-1,e.strstart++,n&&(te(e,!1),0===e.strm.avail_out))return Z}else if(e.match_available){if((n=a._tr_tally(e,0,e.window[e.strstart-1]))&&te(e,!1),e.strstart++,e.lookahead--,0===e.strm.avail_out)return Z}else e.match_available=1,e.strstart++,e.lookahead--}return e.match_available&&(n=a._tr_tally(e,0,e.window[e.strstart-1]),e.match_available=0),e.insert=e.strstart<U-1?e.strstart:U-1,t===l?(te(e,!0),0===e.strm.avail_out?V:Y):e.last_lit&&(te(e,!1),0===e.strm.avail_out)?Z:G}function ue(e,t,r,n,i){this.good_length=e,this.max_lazy=t,this.nice_length=r,this.max_chain=n,this.func=i}function ce(){this.strm=null,this.status=0,this.pending_buf=null,this.pending_buf_size=0,this.pending_out=0,this.pending=0,this.wrap=0,this.gzhead=null,this.gzindex=0,this.method=P,this.last_flush=-1,this.w_size=0,this.w_bits=0,this.w_mask=0,this.window=null,this.window_size=0,this.prev=null,this.head=null,this.ins_h=0,this.hash_size=0,this.hash_bits=0,this.hash_mask=0,this.hash_shift=0,this.block_start=0,this.match_length=0,this.prev_match=0,this.match_available=0,this.strstart=0,this.match_start=0,this.lookahead=0,this.prev_length=0,this.max_chain_length=0,this.max_lazy_match=0,this.level=0,this.strategy=0,this.good_match=0,this.nice_match=0,this.dyn_ltree=new i.Buf16(2*K),this.dyn_dtree=new i.Buf16(2*(2*R+1)),this.bl_tree=new i.Buf16(2*(2*B+1)),Q(this.dyn_ltree),Q(this.dyn_dtree),Q(this.bl_tree),this.l_desc=null,this.d_desc=null,this.bl_desc=null,this.bl_count=new i.Buf16(I+1),this.heap=new i.Buf16(2*j+1),Q(this.heap),this.heap_len=0,this.heap_max=0,this.depth=new i.Buf16(2*j+1),Q(this.depth),this.l_buf=0,this.lit_bufsize=0,this.last_lit=0,this.d_buf=0,this.opt_len=0,this.static_len=0,this.matches=0,this.insert=0,this.bi_buf=0,this.bi_valid=0}function fe(e){var t;return e&&e.state?(e.total_in=e.total_out=0,e.data_type=E,(t=e.state).pending=0,t.pending_out=0,t.wrap<0&&(t.wrap=-t.wrap),t.status=t.wrap?D:W,e.adler=2===t.wrap?0:1,t.last_flush=c,a._tr_init(t),p):$(e,b)}function de(e){var t,r=fe(e);return r===p&&((t=e.state).window_size=2*t.w_size,Q(t.head),t.max_lazy_match=n[t.level].max_lazy,t.good_match=n[t.level].good_length,t.nice_match=n[t.level].nice_length,t.max_chain_length=n[t.level].max_chain,t.strstart=0,t.block_start=0,t.lookahead=0,t.insert=0,t.match_length=t.prev_length=U-1,t.match_available=0,t.ins_h=0),r}function le(e,t,r,n,a,s){if(!e)return b;var o=1;if(t===w&&(t=6),n<0?(o=0,n=-n):n>15&&(o=2,n-=16),a<1||a>x||r!==P||n<8||n>15||t<0||t>9||s<0||s>A)return $(e,b);8===n&&(n=9);var u=new ce;return e.state=u,u.strm=e,u.wrap=o,u.gzhead=null,u.w_bits=n,u.w_size=1<<u.w_bits,u.w_mask=u.w_size-1,u.hash_bits=a+7,u.hash_size=1<<u.hash_bits,u.hash_mask=u.hash_size-1,u.hash_shift=~~((u.hash_bits+U-1)/U),u.window=new i.Buf8(2*u.w_size),u.head=new i.Buf16(u.hash_size),u.prev=new i.Buf16(u.w_size),u.lit_bufsize=1<<a+6,u.pending_buf_size=4*u.lit_bufsize,u.pending_buf=new i.Buf8(u.pending_buf_size),u.d_buf=1*u.lit_bufsize,u.l_buf=3*u.lit_bufsize,u.level=t,u.strategy=s,u.method=r,de(e)}n=[new ue(0,0,0,0,function(e,t){var r=65535;for(r>e.pending_buf_size-5&&(r=e.pending_buf_size-5);;){if(e.lookahead<=1){if(ae(e),0===e.lookahead&&t===c)return Z;if(0===e.lookahead)break}e.strstart+=e.lookahead,e.lookahead=0;var n=e.block_start+r;if((0===e.strstart||e.strstart>=n)&&(e.lookahead=e.strstart-n,e.strstart=n,te(e,!1),0===e.strm.avail_out))return Z;if(e.strstart-e.block_start>=e.w_size-z&&(te(e,!1),0===e.strm.avail_out))return Z}return e.insert=0,t===l?(te(e,!0),0===e.strm.avail_out?V:Y):(e.strstart>e.block_start&&(te(e,!1),e.strm.avail_out),Z)}),new ue(4,4,8,4,se),new ue(4,5,16,8,se),new ue(4,6,32,32,se),new ue(4,4,16,16,oe),new ue(8,16,32,32,oe),new ue(8,16,128,128,oe),new ue(8,32,128,256,oe),new ue(32,128,258,1024,oe),new ue(32,258,258,4096,oe)],r.deflateInit=function(e,t){return le(e,t,P,M,C,S)},r.deflateInit2=le,r.deflateReset=de,r.deflateResetKeep=fe,r.deflateSetHeader=function(e,t){return e&&e.state?2!==e.state.wrap?b:(e.state.gzhead=t,p):b},r.deflate=function(e,t){var r,i,s,u;if(!e||!e.state||t>h||t<0)return e?$(e,b):b;if(i=e.state,!e.output||!e.input&&0!==e.avail_in||i.status===H&&t!==l)return $(e,0===e.avail_out?g:b);if(i.strm=e,r=i.last_flush,i.last_flush=t,i.status===D)if(2===i.wrap)e.adler=0,re(i,31),re(i,139),re(i,8),i.gzhead?(re(i,(i.gzhead.text?1:0)+(i.gzhead.hcrc?2:0)+(i.gzhead.extra?4:0)+(i.gzhead.name?8:0)+(i.gzhead.comment?16:0)),re(i,255&i.gzhead.time),re(i,i.gzhead.time>>8&255),re(i,i.gzhead.time>>16&255),re(i,i.gzhead.time>>24&255),re(i,9===i.level?2:i.strategy>=v||i.level<2?4:0),re(i,255&i.gzhead.os),i.gzhead.extra&&i.gzhead.extra.length&&(re(i,255&i.gzhead.extra.length),re(i,i.gzhead.extra.length>>8&255)),i.gzhead.hcrc&&(e.adler=o(e.adler,i.pending_buf,i.pending,0)),i.gzindex=0,i.status=N):(re(i,0),re(i,0),re(i,0),re(i,0),re(i,0),re(i,9===i.level?2:i.strategy>=v||i.level<2?4:0),re(i,X),i.status=W);else{var m=P+(i.w_bits-8<<4)<<8;m|=(i.strategy>=v||i.level<2?0:i.level<6?1:6===i.level?2:3)<<6,0!==i.strstart&&(m|=O),m+=31-m%31,i.status=W,ne(i,m),0!==i.strstart&&(ne(i,e.adler>>>16),ne(i,65535&e.adler)),e.adler=1}if(i.status===N)if(i.gzhead.extra){for(s=i.pending;i.gzindex<(65535&i.gzhead.extra.length)&&(i.pending!==i.pending_buf_size||(i.gzhead.hcrc&&i.pending>s&&(e.adler=o(e.adler,i.pending_buf,i.pending-s,s)),ee(e),s=i.pending,i.pending!==i.pending_buf_size));)re(i,255&i.gzhead.extra[i.gzindex]),i.gzindex++;i.gzhead.hcrc&&i.pending>s&&(e.adler=o(e.adler,i.pending_buf,i.pending-s,s)),i.gzindex===i.gzhead.extra.length&&(i.gzindex=0,i.status=q)}else i.status=q;if(i.status===q)if(i.gzhead.name){s=i.pending;do{if(i.pending===i.pending_buf_size&&(i.gzhead.hcrc&&i.pending>s&&(e.adler=o(e.adler,i.pending_buf,i.pending-s,s)),ee(e),s=i.pending,i.pending===i.pending_buf_size)){u=1;break}u=i.gzindex<i.gzhead.name.length?255&i.gzhead.name.charCodeAt(i.gzindex++):0,re(i,u)}while(0!==u);i.gzhead.hcrc&&i.pending>s&&(e.adler=o(e.adler,i.pending_buf,i.pending-s,s)),0===u&&(i.gzindex=0,i.status=F)}else i.status=F;if(i.status===F)if(i.gzhead.comment){s=i.pending;do{if(i.pending===i.pending_buf_size&&(i.gzhead.hcrc&&i.pending>s&&(e.adler=o(e.adler,i.pending_buf,i.pending-s,s)),ee(e),s=i.pending,i.pending===i.pending_buf_size)){u=1;break}u=i.gzindex<i.gzhead.comment.length?255&i.gzhead.comment.charCodeAt(i.gzindex++):0,re(i,u)}while(0!==u);i.gzhead.hcrc&&i.pending>s&&(e.adler=o(e.adler,i.pending_buf,i.pending-s,s)),0===u&&(i.status=L)}else i.status=L;if(i.status===L&&(i.gzhead.hcrc?(i.pending+2>i.pending_buf_size&&ee(e),i.pending+2<=i.pending_buf_size&&(re(i,255&e.adler),re(i,e.adler>>8&255),e.adler=0,i.status=W)):i.status=W),0!==i.pending){if(ee(e),0===e.avail_out)return i.last_flush=-1,p}else if(0===e.avail_in&&J(t)<=J(r)&&t!==l)return $(e,g);if(i.status===H&&0!==e.avail_in)return $(e,g);if(0!==e.avail_in||0!==i.lookahead||t!==c&&i.status!==H){var w=i.strategy===v?function(e,t){for(var r;;){if(0===e.lookahead&&(ae(e),0===e.lookahead)){if(t===c)return Z;break}if(e.match_length=0,r=a._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++,r&&(te(e,!1),0===e.strm.avail_out))return Z}return e.insert=0,t===l?(te(e,!0),0===e.strm.avail_out?V:Y):e.last_lit&&(te(e,!1),0===e.strm.avail_out)?Z:G}(i,t):i.strategy===k?function(e,t){for(var r,n,i,s,o=e.window;;){if(e.lookahead<=T){if(ae(e),e.lookahead<=T&&t===c)return Z;if(0===e.lookahead)break}if(e.match_length=0,e.lookahead>=U&&e.strstart>0&&(n=o[i=e.strstart-1])===o[++i]&&n===o[++i]&&n===o[++i]){s=e.strstart+T;do{}while(n===o[++i]&&n===o[++i]&&n===o[++i]&&n===o[++i]&&n===o[++i]&&n===o[++i]&&n===o[++i]&&n===o[++i]&&i<s);e.match_length=T-(s-i),e.match_length>e.lookahead&&(e.match_length=e.lookahead)}if(e.match_length>=U?(r=a._tr_tally(e,1,e.match_length-U),e.lookahead-=e.match_length,e.strstart+=e.match_length,e.match_length=0):(r=a._tr_tally(e,0,e.window[e.strstart]),e.lookahead--,e.strstart++),r&&(te(e,!1),0===e.strm.avail_out))return Z}return e.insert=0,t===l?(te(e,!0),0===e.strm.avail_out?V:Y):e.last_lit&&(te(e,!1),0===e.strm.avail_out)?Z:G}(i,t):n[i.level].func(i,t);if(w!==V&&w!==Y||(i.status=H),w===Z||w===V)return 0===e.avail_out&&(i.last_flush=-1),p;if(w===G&&(t===f?a._tr_align(i):t!==h&&(a._tr_stored_block(i,0,0,!1),t===d&&(Q(i.head),0===i.lookahead&&(i.strstart=0,i.block_start=0,i.insert=0))),ee(e),0===e.avail_out))return i.last_flush=-1,p}return t!==l?p:i.wrap<=0?y:(2===i.wrap?(re(i,255&e.adler),re(i,e.adler>>8&255),re(i,e.adler>>16&255),re(i,e.adler>>24&255),re(i,255&e.total_in),re(i,e.total_in>>8&255),re(i,e.total_in>>16&255),re(i,e.total_in>>24&255)):(ne(i,e.adler>>>16),ne(i,65535&e.adler)),ee(e),i.wrap>0&&(i.wrap=-i.wrap),0!==i.pending?p:y)},r.deflateEnd=function(e){var t;return e&&e.state?(t=e.state.status)!==D&&t!==N&&t!==q&&t!==F&&t!==L&&t!==W&&t!==H?$(e,b):(e.state=null,t===W?$(e,m):p):b},r.deflateSetDictionary=function(e,t){var r,n,a,o,u,c,f,d,l=t.length;if(!e||!e.state)return b;if(2===(o=(r=e.state).wrap)||1===o&&r.status!==D||r.lookahead)return b;for(1===o&&(e.adler=s(e.adler,t,l,0)),r.wrap=0,l>=r.w_size&&(0===o&&(Q(r.head),r.strstart=0,r.block_start=0,r.insert=0),d=new i.Buf8(r.w_size),i.arraySet(d,t,l-r.w_size,r.w_size,0),t=d,l=r.w_size),u=e.avail_in,c=e.next_in,f=e.input,e.avail_in=l,e.next_in=0,e.input=t,ae(r);r.lookahead>=U;){n=r.strstart,a=r.lookahead-(U-1);do{r.ins_h=(r.ins_h<<r.hash_shift^r.window[n+U-1])&r.hash_mask,r.prev[n&r.w_mask]=r.head[r.ins_h],r.head[r.ins_h]=n,n++}while(--a);r.strstart=n,r.lookahead=U-1,ae(r)}return r.strstart+=r.lookahead,r.block_start=r.strstart,r.insert=r.lookahead,r.lookahead=0,r.match_length=r.prev_length=U-1,r.match_available=0,e.next_in=c,e.input=f,e.avail_in=u,r.wrap=o,p},r.deflateInfo="pako deflate (from Nodeca project)"},{"../utils/common":55,"./adler32":57,"./crc32":59,"./messages":65,"./trees":66}],61:[function(e,t,r){"use strict";t.exports=function(){this.text=0,this.time=0,this.xflags=0,this.os=0,this.extra=null,this.extra_len=0,this.name="",this.comment="",this.hcrc=0,this.done=!1}},{}],62:[function(e,t,r){"use strict";t.exports=function(e,t){var r,n,i,a,s,o,u,c,f,d,l,h,p,y,b,m,g,w,_,v,k,A,S,E,P;r=e.state,n=e.next_in,E=e.input,i=n+(e.avail_in-5),a=e.next_out,P=e.output,s=a-(t-e.avail_out),o=a+(e.avail_out-257),u=r.dmax,c=r.wsize,f=r.whave,d=r.wnext,l=r.window,h=r.hold,p=r.bits,y=r.lencode,b=r.distcode,m=(1<<r.lenbits)-1,g=(1<<r.distbits)-1;e:do{p<15&&(h+=E[n++]<<p,p+=8,h+=E[n++]<<p,p+=8),w=y[h&m];t:for(;;){if(h>>>=_=w>>>24,p-=_,0===(_=w>>>16&255))P[a++]=65535&w;else{if(!(16&_)){if(0==(64&_)){w=y[(65535&w)+(h&(1<<_)-1)];continue t}if(32&_){r.mode=12;break e}e.msg="invalid literal/length code",r.mode=30;break e}v=65535&w,(_&=15)&&(p<_&&(h+=E[n++]<<p,p+=8),v+=h&(1<<_)-1,h>>>=_,p-=_),p<15&&(h+=E[n++]<<p,p+=8,h+=E[n++]<<p,p+=8),w=b[h&g];r:for(;;){if(h>>>=_=w>>>24,p-=_,!(16&(_=w>>>16&255))){if(0==(64&_)){w=b[(65535&w)+(h&(1<<_)-1)];continue r}e.msg="invalid distance code",r.mode=30;break e}if(k=65535&w,p<(_&=15)&&(h+=E[n++]<<p,(p+=8)<_&&(h+=E[n++]<<p,p+=8)),(k+=h&(1<<_)-1)>u){e.msg="invalid distance too far back",r.mode=30;break e}if(h>>>=_,p-=_,k>(_=a-s)){if((_=k-_)>f&&r.sane){e.msg="invalid distance too far back",r.mode=30;break e}if(A=0,S=l,0===d){if(A+=c-_,_<v){v-=_;do{P[a++]=l[A++]}while(--_);A=a-k,S=P}}else if(d<_){if(A+=c+d-_,(_-=d)<v){v-=_;do{P[a++]=l[A++]}while(--_);if(A=0,d<v){v-=_=d;do{P[a++]=l[A++]}while(--_);A=a-k,S=P}}}else if(A+=d-_,_<v){v-=_;do{P[a++]=l[A++]}while(--_);A=a-k,S=P}for(;v>2;)P[a++]=S[A++],P[a++]=S[A++],P[a++]=S[A++],v-=3;v&&(P[a++]=S[A++],v>1&&(P[a++]=S[A++]))}else{A=a-k;do{P[a++]=P[A++],P[a++]=P[A++],P[a++]=P[A++],v-=3}while(v>2);v&&(P[a++]=P[A++],v>1&&(P[a++]=P[A++]))}break}}break}}while(n<i&&a<o);n-=v=p>>3,h&=(1<<(p-=v<<3))-1,e.next_in=n,e.next_out=a,e.avail_in=n<i?i-n+5:5-(n-i),e.avail_out=a<o?o-a+257:257-(a-o),r.hold=h,r.bits=p}},{}],63:[function(e,t,r){"use strict";var n=e("../utils/common"),i=e("./adler32"),a=e("./crc32"),s=e("./inffast"),o=e("./inftrees"),u=0,c=1,f=2,d=4,l=5,h=6,p=0,y=1,b=2,m=-2,g=-3,w=-4,_=-5,v=8,k=1,A=2,S=3,E=4,P=5,x=6,M=7,C=8,j=9,R=10,B=11,K=12,I=13,U=14,T=15,z=16,O=17,D=18,N=19,q=20,F=21,L=22,W=23,H=24,Z=25,G=26,V=27,Y=28,X=29,$=30,J=31,Q=32,ee=852,te=592,re=15;function ne(e){return(e>>>24&255)+(e>>>8&65280)+((65280&e)<<8)+((255&e)<<24)}function ie(){this.mode=0,this.last=!1,this.wrap=0,this.havedict=!1,this.flags=0,this.dmax=0,this.check=0,this.total=0,this.head=null,this.wbits=0,this.wsize=0,this.whave=0,this.wnext=0,this.window=null,this.hold=0,this.bits=0,this.length=0,this.offset=0,this.extra=0,this.lencode=null,this.distcode=null,this.lenbits=0,this.distbits=0,this.ncode=0,this.nlen=0,this.ndist=0,this.have=0,this.next=null,this.lens=new n.Buf16(320),this.work=new n.Buf16(288),this.lendyn=null,this.distdyn=null,this.sane=0,this.back=0,this.was=0}function ae(e){var t;return e&&e.state?(t=e.state,e.total_in=e.total_out=t.total=0,e.msg="",t.wrap&&(e.adler=1&t.wrap),t.mode=k,t.last=0,t.havedict=0,t.dmax=32768,t.head=null,t.hold=0,t.bits=0,t.lencode=t.lendyn=new n.Buf32(ee),t.distcode=t.distdyn=new n.Buf32(te),t.sane=1,t.back=-1,p):m}function se(e){var t;return e&&e.state?((t=e.state).wsize=0,t.whave=0,t.wnext=0,ae(e)):m}function oe(e,t){var r,n;return e&&e.state?(n=e.state,t<0?(r=0,t=-t):(r=1+(t>>4),t<48&&(t&=15)),t&&(t<8||t>15)?m:(null!==n.window&&n.wbits!==t&&(n.window=null),n.wrap=r,n.wbits=t,se(e))):m}function ue(e,t){var r,n;return e?(n=new ie,e.state=n,n.window=null,(r=oe(e,t))!==p&&(e.state=null),r):m}var ce,fe,de=!0;function le(e){if(de){var t;for(ce=new n.Buf32(512),fe=new n.Buf32(32),t=0;t<144;)e.lens[t++]=8;for(;t<256;)e.lens[t++]=9;for(;t<280;)e.lens[t++]=7;for(;t<288;)e.lens[t++]=8;for(o(c,e.lens,0,288,ce,0,e.work,{bits:9}),t=0;t<32;)e.lens[t++]=5;o(f,e.lens,0,32,fe,0,e.work,{bits:5}),de=!1}e.lencode=ce,e.lenbits=9,e.distcode=fe,e.distbits=5}function he(e,t,r,i){var a,s=e.state;return null===s.window&&(s.wsize=1<<s.wbits,s.wnext=0,s.whave=0,s.window=new n.Buf8(s.wsize)),i>=s.wsize?(n.arraySet(s.window,t,r-s.wsize,s.wsize,0),s.wnext=0,s.whave=s.wsize):((a=s.wsize-s.wnext)>i&&(a=i),n.arraySet(s.window,t,r-i,a,s.wnext),(i-=a)?(n.arraySet(s.window,t,r-i,i,0),s.wnext=i,s.whave=s.wsize):(s.wnext+=a,s.wnext===s.wsize&&(s.wnext=0),s.whave<s.wsize&&(s.whave+=a))),0}r.inflateReset=se,r.inflateReset2=oe,r.inflateResetKeep=ae,r.inflateInit=function(e){return ue(e,re)},r.inflateInit2=ue,r.inflate=function(e,t){var r,ee,te,re,ie,ae,se,oe,ue,ce,fe,de,pe,ye,be,me,ge,we,_e,ve,ke,Ae,Se,Ee,Pe=0,xe=new n.Buf8(4),Me=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];if(!e||!e.state||!e.output||!e.input&&0!==e.avail_in)return m;(r=e.state).mode===K&&(r.mode=I),ie=e.next_out,te=e.output,se=e.avail_out,re=e.next_in,ee=e.input,ae=e.avail_in,oe=r.hold,ue=r.bits,ce=ae,fe=se,Ae=p;e:for(;;)switch(r.mode){case k:if(0===r.wrap){r.mode=I;break}for(;ue<16;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(2&r.wrap&&35615===oe){r.check=0,xe[0]=255&oe,xe[1]=oe>>>8&255,r.check=a(r.check,xe,2,0),oe=0,ue=0,r.mode=A;break}if(r.flags=0,r.head&&(r.head.done=!1),!(1&r.wrap)||(((255&oe)<<8)+(oe>>8))%31){e.msg="incorrect header check",r.mode=$;break}if((15&oe)!==v){e.msg="unknown compression method",r.mode=$;break}if(ue-=4,ke=8+(15&(oe>>>=4)),0===r.wbits)r.wbits=ke;else if(ke>r.wbits){e.msg="invalid window size",r.mode=$;break}r.dmax=1<<ke,e.adler=r.check=1,r.mode=512&oe?R:K,oe=0,ue=0;break;case A:for(;ue<16;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(r.flags=oe,(255&r.flags)!==v){e.msg="unknown compression method",r.mode=$;break}if(57344&r.flags){e.msg="unknown header flags set",r.mode=$;break}r.head&&(r.head.text=oe>>8&1),512&r.flags&&(xe[0]=255&oe,xe[1]=oe>>>8&255,r.check=a(r.check,xe,2,0)),oe=0,ue=0,r.mode=S;case S:for(;ue<32;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}r.head&&(r.head.time=oe),512&r.flags&&(xe[0]=255&oe,xe[1]=oe>>>8&255,xe[2]=oe>>>16&255,xe[3]=oe>>>24&255,r.check=a(r.check,xe,4,0)),oe=0,ue=0,r.mode=E;case E:for(;ue<16;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}r.head&&(r.head.xflags=255&oe,r.head.os=oe>>8),512&r.flags&&(xe[0]=255&oe,xe[1]=oe>>>8&255,r.check=a(r.check,xe,2,0)),oe=0,ue=0,r.mode=P;case P:if(1024&r.flags){for(;ue<16;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}r.length=oe,r.head&&(r.head.extra_len=oe),512&r.flags&&(xe[0]=255&oe,xe[1]=oe>>>8&255,r.check=a(r.check,xe,2,0)),oe=0,ue=0}else r.head&&(r.head.extra=null);r.mode=x;case x:if(1024&r.flags&&((de=r.length)>ae&&(de=ae),de&&(r.head&&(ke=r.head.extra_len-r.length,r.head.extra||(r.head.extra=new Array(r.head.extra_len)),n.arraySet(r.head.extra,ee,re,de,ke)),512&r.flags&&(r.check=a(r.check,ee,de,re)),ae-=de,re+=de,r.length-=de),r.length))break e;r.length=0,r.mode=M;case M:if(2048&r.flags){if(0===ae)break e;de=0;do{ke=ee[re+de++],r.head&&ke&&r.length<65536&&(r.head.name+=String.fromCharCode(ke))}while(ke&&de<ae);if(512&r.flags&&(r.check=a(r.check,ee,de,re)),ae-=de,re+=de,ke)break e}else r.head&&(r.head.name=null);r.length=0,r.mode=C;case C:if(4096&r.flags){if(0===ae)break e;de=0;do{ke=ee[re+de++],r.head&&ke&&r.length<65536&&(r.head.comment+=String.fromCharCode(ke))}while(ke&&de<ae);if(512&r.flags&&(r.check=a(r.check,ee,de,re)),ae-=de,re+=de,ke)break e}else r.head&&(r.head.comment=null);r.mode=j;case j:if(512&r.flags){for(;ue<16;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(oe!==(65535&r.check)){e.msg="header crc mismatch",r.mode=$;break}oe=0,ue=0}r.head&&(r.head.hcrc=r.flags>>9&1,r.head.done=!0),e.adler=r.check=0,r.mode=K;break;case R:for(;ue<32;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}e.adler=r.check=ne(oe),oe=0,ue=0,r.mode=B;case B:if(0===r.havedict)return e.next_out=ie,e.avail_out=se,e.next_in=re,e.avail_in=ae,r.hold=oe,r.bits=ue,b;e.adler=r.check=1,r.mode=K;case K:if(t===l||t===h)break e;case I:if(r.last){oe>>>=7&ue,ue-=7&ue,r.mode=V;break}for(;ue<3;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}switch(r.last=1&oe,ue-=1,3&(oe>>>=1)){case 0:r.mode=U;break;case 1:if(le(r),r.mode=q,t===h){oe>>>=2,ue-=2;break e}break;case 2:r.mode=O;break;case 3:e.msg="invalid block type",r.mode=$}oe>>>=2,ue-=2;break;case U:for(oe>>>=7&ue,ue-=7&ue;ue<32;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if((65535&oe)!=(oe>>>16^65535)){e.msg="invalid stored block lengths",r.mode=$;break}if(r.length=65535&oe,oe=0,ue=0,r.mode=T,t===h)break e;case T:r.mode=z;case z:if(de=r.length){if(de>ae&&(de=ae),de>se&&(de=se),0===de)break e;n.arraySet(te,ee,re,de,ie),ae-=de,re+=de,se-=de,ie+=de,r.length-=de;break}r.mode=K;break;case O:for(;ue<14;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(r.nlen=257+(31&oe),oe>>>=5,ue-=5,r.ndist=1+(31&oe),oe>>>=5,ue-=5,r.ncode=4+(15&oe),oe>>>=4,ue-=4,r.nlen>286||r.ndist>30){e.msg="too many length or distance symbols",r.mode=$;break}r.have=0,r.mode=D;case D:for(;r.have<r.ncode;){for(;ue<3;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}r.lens[Me[r.have++]]=7&oe,oe>>>=3,ue-=3}for(;r.have<19;)r.lens[Me[r.have++]]=0;if(r.lencode=r.lendyn,r.lenbits=7,Se={bits:r.lenbits},Ae=o(u,r.lens,0,19,r.lencode,0,r.work,Se),r.lenbits=Se.bits,Ae){e.msg="invalid code lengths set",r.mode=$;break}r.have=0,r.mode=N;case N:for(;r.have<r.nlen+r.ndist;){for(;me=(Pe=r.lencode[oe&(1<<r.lenbits)-1])>>>16&255,ge=65535&Pe,!((be=Pe>>>24)<=ue);){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(ge<16)oe>>>=be,ue-=be,r.lens[r.have++]=ge;else{if(16===ge){for(Ee=be+2;ue<Ee;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(oe>>>=be,ue-=be,0===r.have){e.msg="invalid bit length repeat",r.mode=$;break}ke=r.lens[r.have-1],de=3+(3&oe),oe>>>=2,ue-=2}else if(17===ge){for(Ee=be+3;ue<Ee;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}ue-=be,ke=0,de=3+(7&(oe>>>=be)),oe>>>=3,ue-=3}else{for(Ee=be+7;ue<Ee;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}ue-=be,ke=0,de=11+(127&(oe>>>=be)),oe>>>=7,ue-=7}if(r.have+de>r.nlen+r.ndist){e.msg="invalid bit length repeat",r.mode=$;break}for(;de--;)r.lens[r.have++]=ke}}if(r.mode===$)break;if(0===r.lens[256]){e.msg="invalid code -- missing end-of-block",r.mode=$;break}if(r.lenbits=9,Se={bits:r.lenbits},Ae=o(c,r.lens,0,r.nlen,r.lencode,0,r.work,Se),r.lenbits=Se.bits,Ae){e.msg="invalid literal/lengths set",r.mode=$;break}if(r.distbits=6,r.distcode=r.distdyn,Se={bits:r.distbits},Ae=o(f,r.lens,r.nlen,r.ndist,r.distcode,0,r.work,Se),r.distbits=Se.bits,Ae){e.msg="invalid distances set",r.mode=$;break}if(r.mode=q,t===h)break e;case q:r.mode=F;case F:if(ae>=6&&se>=258){e.next_out=ie,e.avail_out=se,e.next_in=re,e.avail_in=ae,r.hold=oe,r.bits=ue,s(e,fe),ie=e.next_out,te=e.output,se=e.avail_out,re=e.next_in,ee=e.input,ae=e.avail_in,oe=r.hold,ue=r.bits,r.mode===K&&(r.back=-1);break}for(r.back=0;me=(Pe=r.lencode[oe&(1<<r.lenbits)-1])>>>16&255,ge=65535&Pe,!((be=Pe>>>24)<=ue);){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(me&&0==(240&me)){for(we=be,_e=me,ve=ge;me=(Pe=r.lencode[ve+((oe&(1<<we+_e)-1)>>we)])>>>16&255,ge=65535&Pe,!(we+(be=Pe>>>24)<=ue);){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}oe>>>=we,ue-=we,r.back+=we}if(oe>>>=be,ue-=be,r.back+=be,r.length=ge,0===me){r.mode=G;break}if(32&me){r.back=-1,r.mode=K;break}if(64&me){e.msg="invalid literal/length code",r.mode=$;break}r.extra=15&me,r.mode=L;case L:if(r.extra){for(Ee=r.extra;ue<Ee;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}r.length+=oe&(1<<r.extra)-1,oe>>>=r.extra,ue-=r.extra,r.back+=r.extra}r.was=r.length,r.mode=W;case W:for(;me=(Pe=r.distcode[oe&(1<<r.distbits)-1])>>>16&255,ge=65535&Pe,!((be=Pe>>>24)<=ue);){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(0==(240&me)){for(we=be,_e=me,ve=ge;me=(Pe=r.distcode[ve+((oe&(1<<we+_e)-1)>>we)])>>>16&255,ge=65535&Pe,!(we+(be=Pe>>>24)<=ue);){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}oe>>>=we,ue-=we,r.back+=we}if(oe>>>=be,ue-=be,r.back+=be,64&me){e.msg="invalid distance code",r.mode=$;break}r.offset=ge,r.extra=15&me,r.mode=H;case H:if(r.extra){for(Ee=r.extra;ue<Ee;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}r.offset+=oe&(1<<r.extra)-1,oe>>>=r.extra,ue-=r.extra,r.back+=r.extra}if(r.offset>r.dmax){e.msg="invalid distance too far back",r.mode=$;break}r.mode=Z;case Z:if(0===se)break e;if(de=fe-se,r.offset>de){if((de=r.offset-de)>r.whave&&r.sane){e.msg="invalid distance too far back",r.mode=$;break}de>r.wnext?(de-=r.wnext,pe=r.wsize-de):pe=r.wnext-de,de>r.length&&(de=r.length),ye=r.window}else ye=te,pe=ie-r.offset,de=r.length;de>se&&(de=se),se-=de,r.length-=de;do{te[ie++]=ye[pe++]}while(--de);0===r.length&&(r.mode=F);break;case G:if(0===se)break e;te[ie++]=r.length,se--,r.mode=F;break;case V:if(r.wrap){for(;ue<32;){if(0===ae)break e;ae--,oe|=ee[re++]<<ue,ue+=8}if(fe-=se,e.total_out+=fe,r.total+=fe,fe&&(e.adler=r.check=r.flags?a(r.check,te,fe,ie-fe):i(r.check,te,fe,ie-fe)),fe=se,(r.flags?oe:ne(oe))!==r.check){e.msg="incorrect data check",r.mode=$;break}oe=0,ue=0}r.mode=Y;case Y:if(r.wrap&&r.flags){for(;ue<32;){if(0===ae)break e;ae--,oe+=ee[re++]<<ue,ue+=8}if(oe!==(4294967295&r.total)){e.msg="incorrect length check",r.mode=$;break}oe=0,ue=0}r.mode=X;case X:Ae=y;break e;case $:Ae=g;break e;case J:return w;case Q:default:return m}return e.next_out=ie,e.avail_out=se,e.next_in=re,e.avail_in=ae,r.hold=oe,r.bits=ue,(r.wsize||fe!==e.avail_out&&r.mode<$&&(r.mode<V||t!==d))&&he(e,e.output,e.next_out,fe-e.avail_out)?(r.mode=J,w):(ce-=e.avail_in,fe-=e.avail_out,e.total_in+=ce,e.total_out+=fe,r.total+=fe,r.wrap&&fe&&(e.adler=r.check=r.flags?a(r.check,te,fe,e.next_out-fe):i(r.check,te,fe,e.next_out-fe)),e.data_type=r.bits+(r.last?64:0)+(r.mode===K?128:0)+(r.mode===q||r.mode===T?256:0),(0===ce&&0===fe||t===d)&&Ae===p&&(Ae=_),Ae)},r.inflateEnd=function(e){if(!e||!e.state)return m;var t=e.state;return t.window&&(t.window=null),e.state=null,p},r.inflateGetHeader=function(e,t){var r;return e&&e.state?0==(2&(r=e.state).wrap)?m:(r.head=t,t.done=!1,p):m},r.inflateSetDictionary=function(e,t){var r,n=t.length;return e&&e.state?0!==(r=e.state).wrap&&r.mode!==B?m:r.mode===B&&i(1,t,n,0)!==r.check?g:he(e,t,n,n)?(r.mode=J,w):(r.havedict=1,p):m},r.inflateInfo="pako inflate (from Nodeca project)"},{"../utils/common":55,"./adler32":57,"./crc32":59,"./inffast":62,"./inftrees":64}],64:[function(e,t,r){"use strict";var n=e("../utils/common"),i=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,0,0],a=[16,16,16,16,16,16,16,16,17,17,17,17,18,18,18,18,19,19,19,19,20,20,20,20,21,21,21,21,16,72,78],s=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577,0,0],o=[16,16,16,16,17,17,18,18,19,19,20,20,21,21,22,22,23,23,24,24,25,25,26,26,27,27,28,28,29,29,64,64];t.exports=function(e,t,r,u,c,f,d,l){var h,p,y,b,m,g,w,_,v,k=l.bits,A=0,S=0,E=0,P=0,x=0,M=0,C=0,j=0,R=0,B=0,K=null,I=0,U=new n.Buf16(16),T=new n.Buf16(16),z=null,O=0;for(A=0;A<=15;A++)U[A]=0;for(S=0;S<u;S++)U[t[r+S]]++;for(x=k,P=15;P>=1&&0===U[P];P--);if(x>P&&(x=P),0===P)return c[f++]=20971520,c[f++]=20971520,l.bits=1,0;for(E=1;E<P&&0===U[E];E++);for(x<E&&(x=E),j=1,A=1;A<=15;A++)if(j<<=1,(j-=U[A])<0)return-1;if(j>0&&(0===e||1!==P))return-1;for(T[1]=0,A=1;A<15;A++)T[A+1]=T[A]+U[A];for(S=0;S<u;S++)0!==t[r+S]&&(d[T[t[r+S]]++]=S);if(0===e?(K=z=d,g=19):1===e?(K=i,I-=257,z=a,O-=257,g=256):(K=s,z=o,g=-1),B=0,S=0,A=E,m=f,M=x,C=0,y=-1,b=(R=1<<x)-1,1===e&&R>852||2===e&&R>592)return 1;for(;;){w=A-C,d[S]<g?(_=0,v=d[S]):d[S]>g?(_=z[O+d[S]],v=K[I+d[S]]):(_=96,v=0),h=1<<A-C,E=p=1<<M;do{c[m+(B>>C)+(p-=h)]=w<<24|_<<16|v|0}while(0!==p);for(h=1<<A-1;B&h;)h>>=1;if(0!==h?(B&=h-1,B+=h):B=0,S++,0==--U[A]){if(A===P)break;A=t[r+d[S]]}if(A>x&&(B&b)!==y){for(0===C&&(C=x),m+=E,j=1<<(M=A-C);M+C<P&&!((j-=U[M+C])<=0);)M++,j<<=1;if(R+=1<<M,1===e&&R>852||2===e&&R>592)return 1;c[y=B&b]=x<<24|M<<16|m-f|0}}return 0!==B&&(c[m+B]=A-C<<24|64<<16|0),l.bits=x,0}},{"../utils/common":55}],65:[function(e,t,r){"use strict";t.exports={2:"need dictionary",1:"stream end",0:"","-1":"file error","-2":"stream error","-3":"data error","-4":"insufficient memory","-5":"buffer error","-6":"incompatible version"}},{}],66:[function(e,t,r){"use strict";var n=e("../utils/common"),i=4,a=0,s=1,o=2;function u(e){for(var t=e.length;--t>=0;)e[t]=0}var c=0,f=1,d=2,l=29,h=256,p=h+1+l,y=30,b=19,m=2*p+1,g=15,w=16,_=7,v=256,k=16,A=17,S=18,E=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],P=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],x=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,3,7],M=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],C=new Array(2*(p+2));u(C);var j=new Array(2*y);u(j);var R=new Array(512);u(R);var B=new Array(256);u(B);var K=new Array(l);u(K);var I,U,T,z=new Array(y);function O(e,t,r,n,i){this.static_tree=e,this.extra_bits=t,this.extra_base=r,this.elems=n,this.max_length=i,this.has_stree=e&&e.length}function D(e,t){this.dyn_tree=e,this.max_code=0,this.stat_desc=t}function N(e){return e<256?R[e]:R[256+(e>>>7)]}function q(e,t){e.pending_buf[e.pending++]=255&t,e.pending_buf[e.pending++]=t>>>8&255}function F(e,t,r){e.bi_valid>w-r?(e.bi_buf|=t<<e.bi_valid&65535,q(e,e.bi_buf),e.bi_buf=t>>w-e.bi_valid,e.bi_valid+=r-w):(e.bi_buf|=t<<e.bi_valid&65535,e.bi_valid+=r)}function L(e,t,r){F(e,r[2*t],r[2*t+1])}function W(e,t){var r=0;do{r|=1&e,e>>>=1,r<<=1}while(--t>0);return r>>>1}function H(e,t,r){var n,i,a=new Array(g+1),s=0;for(n=1;n<=g;n++)a[n]=s=s+r[n-1]<<1;for(i=0;i<=t;i++){var o=e[2*i+1];0!==o&&(e[2*i]=W(a[o]++,o))}}function Z(e){var t;for(t=0;t<p;t++)e.dyn_ltree[2*t]=0;for(t=0;t<y;t++)e.dyn_dtree[2*t]=0;for(t=0;t<b;t++)e.bl_tree[2*t]=0;e.dyn_ltree[2*v]=1,e.opt_len=e.static_len=0,e.last_lit=e.matches=0}function G(e){e.bi_valid>8?q(e,e.bi_buf):e.bi_valid>0&&(e.pending_buf[e.pending++]=e.bi_buf),e.bi_buf=0,e.bi_valid=0}function V(e,t,r,n){var i=2*t,a=2*r;return e[i]<e[a]||e[i]===e[a]&&n[t]<=n[r]}function Y(e,t,r){for(var n=e.heap[r],i=r<<1;i<=e.heap_len&&(i<e.heap_len&&V(t,e.heap[i+1],e.heap[i],e.depth)&&i++,!V(t,n,e.heap[i],e.depth));)e.heap[r]=e.heap[i],r=i,i<<=1;e.heap[r]=n}function X(e,t,r){var n,i,a,s,o=0;if(0!==e.last_lit)do{n=e.pending_buf[e.d_buf+2*o]<<8|e.pending_buf[e.d_buf+2*o+1],i=e.pending_buf[e.l_buf+o],o++,0===n?L(e,i,t):(L(e,(a=B[i])+h+1,t),0!==(s=E[a])&&F(e,i-=K[a],s),L(e,a=N(--n),r),0!==(s=P[a])&&F(e,n-=z[a],s))}while(o<e.last_lit);L(e,v,t)}function $(e,t){var r,n,i,a=t.dyn_tree,s=t.stat_desc.static_tree,o=t.stat_desc.has_stree,u=t.stat_desc.elems,c=-1;for(e.heap_len=0,e.heap_max=m,r=0;r<u;r++)0!==a[2*r]?(e.heap[++e.heap_len]=c=r,e.depth[r]=0):a[2*r+1]=0;for(;e.heap_len<2;)a[2*(i=e.heap[++e.heap_len]=c<2?++c:0)]=1,e.depth[i]=0,e.opt_len--,o&&(e.static_len-=s[2*i+1]);for(t.max_code=c,r=e.heap_len>>1;r>=1;r--)Y(e,a,r);i=u;do{r=e.heap[1],e.heap[1]=e.heap[e.heap_len--],Y(e,a,1),n=e.heap[1],e.heap[--e.heap_max]=r,e.heap[--e.heap_max]=n,a[2*i]=a[2*r]+a[2*n],e.depth[i]=(e.depth[r]>=e.depth[n]?e.depth[r]:e.depth[n])+1,a[2*r+1]=a[2*n+1]=i,e.heap[1]=i++,Y(e,a,1)}while(e.heap_len>=2);e.heap[--e.heap_max]=e.heap[1],function(e,t){var r,n,i,a,s,o,u=t.dyn_tree,c=t.max_code,f=t.stat_desc.static_tree,d=t.stat_desc.has_stree,l=t.stat_desc.extra_bits,h=t.stat_desc.extra_base,p=t.stat_desc.max_length,y=0;for(a=0;a<=g;a++)e.bl_count[a]=0;for(u[2*e.heap[e.heap_max]+1]=0,r=e.heap_max+1;r<m;r++)(a=u[2*u[2*(n=e.heap[r])+1]+1]+1)>p&&(a=p,y++),u[2*n+1]=a,n>c||(e.bl_count[a]++,s=0,n>=h&&(s=l[n-h]),o=u[2*n],e.opt_len+=o*(a+s),d&&(e.static_len+=o*(f[2*n+1]+s)));if(0!==y){do{for(a=p-1;0===e.bl_count[a];)a--;e.bl_count[a]--,e.bl_count[a+1]+=2,e.bl_count[p]--,y-=2}while(y>0);for(a=p;0!==a;a--)for(n=e.bl_count[a];0!==n;)(i=e.heap[--r])>c||(u[2*i+1]!==a&&(e.opt_len+=(a-u[2*i+1])*u[2*i],u[2*i+1]=a),n--)}}(e,t),H(a,c,e.bl_count)}function J(e,t,r){var n,i,a=-1,s=t[1],o=0,u=7,c=4;for(0===s&&(u=138,c=3),t[2*(r+1)+1]=65535,n=0;n<=r;n++)i=s,s=t[2*(n+1)+1],++o<u&&i===s||(o<c?e.bl_tree[2*i]+=o:0!==i?(i!==a&&e.bl_tree[2*i]++,e.bl_tree[2*k]++):o<=10?e.bl_tree[2*A]++:e.bl_tree[2*S]++,o=0,a=i,0===s?(u=138,c=3):i===s?(u=6,c=3):(u=7,c=4))}function Q(e,t,r){var n,i,a=-1,s=t[1],o=0,u=7,c=4;for(0===s&&(u=138,c=3),n=0;n<=r;n++)if(i=s,s=t[2*(n+1)+1],!(++o<u&&i===s)){if(o<c)do{L(e,i,e.bl_tree)}while(0!=--o);else 0!==i?(i!==a&&(L(e,i,e.bl_tree),o--),L(e,k,e.bl_tree),F(e,o-3,2)):o<=10?(L(e,A,e.bl_tree),F(e,o-3,3)):(L(e,S,e.bl_tree),F(e,o-11,7));o=0,a=i,0===s?(u=138,c=3):i===s?(u=6,c=3):(u=7,c=4)}}u(z);var ee=!1;function te(e,t,r,i){F(e,(c<<1)+(i?1:0),3),function(e,t,r,i){G(e),i&&(q(e,r),q(e,~r)),n.arraySet(e.pending_buf,e.window,t,r,e.pending),e.pending+=r}(e,t,r,!0)}r._tr_init=function(e){ee||(function(){var e,t,r,n,i,a=new Array(g+1);for(r=0,n=0;n<l-1;n++)for(K[n]=r,e=0;e<1<<E[n];e++)B[r++]=n;for(B[r-1]=n,i=0,n=0;n<16;n++)for(z[n]=i,e=0;e<1<<P[n];e++)R[i++]=n;for(i>>=7;n<y;n++)for(z[n]=i<<7,e=0;e<1<<P[n]-7;e++)R[256+i++]=n;for(t=0;t<=g;t++)a[t]=0;for(e=0;e<=143;)C[2*e+1]=8,e++,a[8]++;for(;e<=255;)C[2*e+1]=9,e++,a[9]++;for(;e<=279;)C[2*e+1]=7,e++,a[7]++;for(;e<=287;)C[2*e+1]=8,e++,a[8]++;for(H(C,p+1,a),e=0;e<y;e++)j[2*e+1]=5,j[2*e]=W(e,5);I=new O(C,E,h+1,p,g),U=new O(j,P,0,y,g),T=new O(new Array(0),x,0,b,_)}(),ee=!0),e.l_desc=new D(e.dyn_ltree,I),e.d_desc=new D(e.dyn_dtree,U),e.bl_desc=new D(e.bl_tree,T),e.bi_buf=0,e.bi_valid=0,Z(e)},r._tr_stored_block=te,r._tr_flush_block=function(e,t,r,n){var u,c,l=0;e.level>0?(e.strm.data_type===o&&(e.strm.data_type=function(e){var t,r=4093624447;for(t=0;t<=31;t++,r>>>=1)if(1&r&&0!==e.dyn_ltree[2*t])return a;if(0!==e.dyn_ltree[18]||0!==e.dyn_ltree[20]||0!==e.dyn_ltree[26])return s;for(t=32;t<h;t++)if(0!==e.dyn_ltree[2*t])return s;return a}(e)),$(e,e.l_desc),$(e,e.d_desc),l=function(e){var t;for(J(e,e.dyn_ltree,e.l_desc.max_code),J(e,e.dyn_dtree,e.d_desc.max_code),$(e,e.bl_desc),t=b-1;t>=3&&0===e.bl_tree[2*M[t]+1];t--);return e.opt_len+=3*(t+1)+5+5+4,t}(e),u=e.opt_len+3+7>>>3,(c=e.static_len+3+7>>>3)<=u&&(u=c)):u=c=r+5,r+4<=u&&-1!==t?te(e,t,r,n):e.strategy===i||c===u?(F(e,(f<<1)+(n?1:0),3),X(e,C,j)):(F(e,(d<<1)+(n?1:0),3),function(e,t,r,n){var i;for(F(e,t-257,5),F(e,r-1,5),F(e,n-4,4),i=0;i<n;i++)F(e,e.bl_tree[2*M[i]+1],3);Q(e,e.dyn_ltree,t-1),Q(e,e.dyn_dtree,r-1)}(e,e.l_desc.max_code+1,e.d_desc.max_code+1,l+1),X(e,e.dyn_ltree,e.dyn_dtree)),Z(e),n&&G(e)},r._tr_tally=function(e,t,r){return e.pending_buf[e.d_buf+2*e.last_lit]=t>>>8&255,e.pending_buf[e.d_buf+2*e.last_lit+1]=255&t,e.pending_buf[e.l_buf+e.last_lit]=255&r,e.last_lit++,0===t?e.dyn_ltree[2*r]++:(e.matches++,t--,e.dyn_ltree[2*(B[r]+h+1)]++,e.dyn_dtree[2*N(t)]++),e.last_lit===e.lit_bufsize-1},r._tr_align=function(e){F(e,f<<1,3),L(e,v,C),function(e){16===e.bi_valid?(q(e,e.bi_buf),e.bi_buf=0,e.bi_valid=0):e.bi_valid>=8&&(e.pending_buf[e.pending++]=255&e.bi_buf,e.bi_buf>>=8,e.bi_valid-=8)}(e)}},{"../utils/common":55}],67:[function(e,t,r){"use strict";t.exports=function(){this.input=null,this.next_in=0,this.avail_in=0,this.total_in=0,this.output=null,this.next_out=0,this.avail_out=0,this.total_out=0,this.msg="",this.state=null,this.data_type=2,this.adler=0}},{}],68:[function(e,t,r){var n,i,a=t.exports={};function s(){throw new Error("setTimeout has not been defined")}function o(){throw new Error("clearTimeout has not been defined")}function u(e){if(n===setTimeout)return setTimeout(e,0);if((n===s||!n)&&setTimeout)return n=setTimeout,setTimeout(e,0);try{return n(e,0)}catch(t){try{return n.call(null,e,0)}catch(t){return n.call(this,e,0)}}}!function(){try{n="function"==typeof setTimeout?setTimeout:s}catch(e){n=s}try{i="function"==typeof clearTimeout?clearTimeout:o}catch(e){i=o}}();var c,f=[],d=!1,l=-1;function h(){d&&c&&(d=!1,c.length?f=c.concat(f):l=-1,f.length&&p())}function p(){if(!d){var e=u(h);d=!0;for(var t=f.length;t;){for(c=f,f=[];++l<t;)c&&c[l].run();l=-1,t=f.length}c=null,d=!1,function(e){if(i===clearTimeout)return clearTimeout(e);if((i===o||!i)&&clearTimeout)return i=clearTimeout,clearTimeout(e);try{i(e)}catch(t){try{return i.call(null,e)}catch(t){return i.call(this,e)}}}(e)}}function y(e,t){this.fun=e,this.array=t}function b(){}a.nextTick=function(e){var t=new Array(arguments.length-1);if(arguments.length>1)for(var r=1;r<arguments.length;r++)t[r-1]=arguments[r];f.push(new y(e,t)),1!==f.length||d||u(p)},y.prototype.run=function(){this.fun.apply(null,this.array)},a.title="browser",a.browser=!0,a.env={},a.argv=[],a.version="",a.versions={},a.on=b,a.addListener=b,a.once=b,a.off=b,a.removeListener=b,a.removeAllListeners=b,a.emit=b,a.prependListener=b,a.prependOnceListener=b,a.listeners=function(e){return[]},a.binding=function(e){throw new Error("process.binding is not supported")},a.cwd=function(){return"/"},a.chdir=function(e){throw new Error("process.chdir is not supported")},a.umask=function(){return 0}},{}],69:[function(e,t,r){"use strict";var n=[0,1,3,7,15,31,63,127,255],i=function(e){this.stream=e,this.bitOffset=0,this.curByte=0,this.hasByte=!1};i.prototype._ensureByte=function(){this.hasByte||(this.curByte=this.stream.readByte(),this.hasByte=!0)},i.prototype.read=function(e){for(var t=0;e>0;){this._ensureByte();var r=8-this.bitOffset;if(e>=r)t<<=r,t|=n[r]&this.curByte,this.hasByte=!1,this.bitOffset=0,e-=r;else{t<<=e;var i=r-e;t|=(this.curByte&n[e]<<i)>>i,this.bitOffset+=e,e=0}}return t},i.prototype.seek=function(e){var t=e%8,r=(e-t)/8;this.bitOffset=t,this.stream.seek(r),this.hasByte=!1},i.prototype.pi=function(){var e,t=new Uint8Array(6);for(e=0;e<t.length;e++)t[e]=this.read(8);return function(e){return Array.prototype.map.call(e,e=>("00"+e.toString(16)).slice(-2)).join("")}(t)},t.exports=i},{}],70:[function(e,t,r){"use strict";var n;t.exports=(n=new Uint32Array([0,79764919,159529838,222504665,319059676,398814059,445009330,507990021,638119352,583659535,797628118,726387553,890018660,835552979,1015980042,944750013,1276238704,1221641927,1167319070,1095957929,1595256236,1540665371,1452775106,1381403509,1780037320,1859660671,1671105958,1733955601,2031960084,2111593891,1889500026,1952343757,2552477408,2632100695,2443283854,2506133561,2334638140,2414271883,2191915858,2254759653,3190512472,3135915759,3081330742,3009969537,2905550212,2850959411,2762807018,2691435357,3560074640,3505614887,3719321342,3648080713,3342211916,3287746299,3467911202,3396681109,4063920168,4143685023,4223187782,4286162673,3779000052,3858754371,3904687514,3967668269,881225847,809987520,1023691545,969234094,662832811,591600412,771767749,717299826,311336399,374308984,453813921,533576470,25881363,88864420,134795389,214552010,2023205639,2086057648,1897238633,1976864222,1804852699,1867694188,1645340341,1724971778,1587496639,1516133128,1461550545,1406951526,1302016099,1230646740,1142491917,1087903418,2896545431,2825181984,2770861561,2716262478,3215044683,3143675388,3055782693,3001194130,2326604591,2389456536,2200899649,2280525302,2578013683,2640855108,2418763421,2498394922,3769900519,3832873040,3912640137,3992402750,4088425275,4151408268,4197601365,4277358050,3334271071,3263032808,3476998961,3422541446,3585640067,3514407732,3694837229,3640369242,1762451694,1842216281,1619975040,1682949687,2047383090,2127137669,1938468188,2001449195,1325665622,1271206113,1183200824,1111960463,1543535498,1489069629,1434599652,1363369299,622672798,568075817,748617968,677256519,907627842,853037301,1067152940,995781531,51762726,131386257,177728840,240578815,269590778,349224269,429104020,491947555,4046411278,4126034873,4172115296,4234965207,3794477266,3874110821,3953728444,4016571915,3609705398,3555108353,3735388376,3664026991,3290680682,3236090077,3449943556,3378572211,3174993278,3120533705,3032266256,2961025959,2923101090,2868635157,2813903052,2742672763,2604032198,2683796849,2461293480,2524268063,2284983834,2364738477,2175806836,2238787779,1569362073,1498123566,1409854455,1355396672,1317987909,1246755826,1192025387,1137557660,2072149281,2135122070,1912620623,1992383480,1753615357,1816598090,1627664531,1707420964,295390185,358241886,404320391,483945776,43990325,106832002,186451547,266083308,932423249,861060070,1041341759,986742920,613929101,542559546,756411363,701822548,3316196985,3244833742,3425377559,3370778784,3601682597,3530312978,3744426955,3689838204,3819031489,3881883254,3928223919,4007849240,4037393693,4100235434,4180117107,4259748804,2310601993,2373574846,2151335527,2231098320,2596047829,2659030626,2470359227,2550115596,2947551409,2876312838,2788305887,2733848168,3165939309,3094707162,3040238851,2985771188]),function(){var e=4294967295;this.getCRC=function(){return~e>>>0},this.updateCRC=function(t){e=e<<8^n[255&(e>>>24^t)]},this.updateCRCRun=function(t,r){for(;r-- >0;)e=e<<8^n[255&(e>>>24^t)]}})},{}],71:[function(e,t,r){"use strict";var n=e("./bitreader"),i=e("./stream"),a=e("./crc32"),s=e("../package.json"),o=function(e,t){var r,n=e[t];for(r=t;r>0;r--)e[r]=e[r-1];return e[0]=n,n},u={OK:0,LAST_BLOCK:-1,NOT_BZIP_DATA:-2,UNEXPECTED_INPUT_EOF:-3,UNEXPECTED_OUTPUT_EOF:-4,DATA_ERROR:-5,OUT_OF_MEMORY:-6,OBSOLETE_INPUT:-7,END_OF_BLOCK:-8},c={};c[u.LAST_BLOCK]="Bad file checksum",c[u.NOT_BZIP_DATA]="Not bzip data",c[u.UNEXPECTED_INPUT_EOF]="Unexpected input EOF",c[u.UNEXPECTED_OUTPUT_EOF]="Unexpected output EOF",c[u.DATA_ERROR]="Data error",c[u.OUT_OF_MEMORY]="Out of memory",c[u.OBSOLETE_INPUT]="Obsolete (pre 0.9.5) bzip format not supported.";var f=function(e,t){var r=c[e]||"unknown error";t&&(r+=": "+t);var n=new TypeError(r);throw n.errorCode=e,n},d=function(e,t){this.writePos=this.writeCurrent=this.writeCount=0,this._start_bunzip(e,t)};d.prototype._init_block=function(){return this._get_next_block()?(this.blockCRC=new a,!0):(this.writeCount=-1,!1)},d.prototype._start_bunzip=function(e,t){var r=new Uint8Array(4);4===e.read(r,0,4)&&"BZh"===String.fromCharCode(r[0],r[1],r[2])||f(u.NOT_BZIP_DATA,"bad magic");var i=r[3]-48;(i<1||i>9)&&f(u.NOT_BZIP_DATA,"level out of range"),this.reader=new n(e),this.dbufSize=1e5*i,this.nextoutput=0,this.outputStream=t,this.streamCRC=0},d.prototype._get_next_block=function(){var e,t,r,n=this.reader,i=n.pi();if("177245385090"===i)return!1;"314159265359"!==i&&f(u.NOT_BZIP_DATA),this.targetBlockCRC=n.read(32)>>>0,this.streamCRC=(this.targetBlockCRC^(this.streamCRC<<1|this.streamCRC>>>31))>>>0,n.read(1)&&f(u.OBSOLETE_INPUT);var a=n.read(24);a>this.dbufSize&&f(u.DATA_ERROR,"initial position out of bounds");var s=n.read(16),c=new Uint8Array(256),d=0;for(e=0;e<16;e++)if(s&1<<15-e){var l=16*e;for(r=n.read(16),t=0;t<16;t++)r&1<<15-t&&(c[d++]=l+t)}var h=n.read(3);(h<2||h>6)&&f(u.DATA_ERROR);var p=n.read(15);0===p&&f(u.DATA_ERROR);var y=new Uint8Array(256);for(e=0;e<h;e++)y[e]=e;var b=new Uint8Array(p);for(e=0;e<p;e++){for(t=0;n.read(1);t++)t>=h&&f(u.DATA_ERROR);b[e]=o(y,t)}var m,g=d+2,w=[];for(t=0;t<h;t++){var _,v,k=new Uint8Array(g),A=new Uint16Array(21);for(s=n.read(5),e=0;e<g;e++){for(;(s<1||s>20)&&f(u.DATA_ERROR),n.read(1);)n.read(1)?s--:s++;k[e]=s}for(_=v=k[0],e=1;e<g;e++)k[e]>v?v=k[e]:k[e]<_&&(_=k[e]);m={},w.push(m),m.permute=new Uint16Array(258),m.limit=new Uint32Array(22),m.base=new Uint32Array(21),m.minLen=_,m.maxLen=v;var S=0;for(e=_;e<=v;e++)for(A[e]=m.limit[e]=0,s=0;s<g;s++)k[s]===e&&(m.permute[S++]=s);for(e=0;e<g;e++)A[k[e]]++;for(S=s=0,e=_;e<v;e++)S+=A[e],m.limit[e]=S-1,S<<=1,s+=A[e],m.base[e+1]=S-s;m.limit[v+1]=Number.MAX_VALUE,m.limit[v]=S+A[v]-1,m.base[_]=0}var E=new Uint32Array(256);for(e=0;e<256;e++)y[e]=e;var P,x=0,M=0,C=0,j=this.dbuf=new Uint32Array(this.dbufSize);for(g=0;;){for(g--||(g=49,C>=p&&f(u.DATA_ERROR),m=w[b[C++]]),e=m.minLen,t=n.read(e);e>m.maxLen&&f(u.DATA_ERROR),!(t<=m.limit[e]);e++)t=t<<1|n.read(1);((t-=m.base[e])<0||t>=258)&&f(u.DATA_ERROR);var R=m.permute[t];if(0!==R&&1!==R){if(x)for(x=0,M+s>this.dbufSize&&f(u.DATA_ERROR),E[P=c[y[0]]]+=s;s--;)j[M++]=P;if(R>d)break;M>=this.dbufSize&&f(u.DATA_ERROR),E[P=c[P=o(y,e=R-1)]]++,j[M++]=P}else x||(x=1,s=0),s+=0===R?x:2*x,x<<=1}for((a<0||a>=M)&&f(u.DATA_ERROR),t=0,e=0;e<256;e++)r=t+E[e],E[e]=t,t=r;for(e=0;e<M;e++)j[E[P=255&j[e]]]|=e<<8,E[P]++;var B=0,K=0,I=0;return M&&(K=255&(B=j[a]),B>>=8,I=-1),this.writePos=B,this.writeCurrent=K,this.writeCount=M,this.writeRun=I,!0},d.prototype._read_bunzip=function(e,t){var r,n,i;if(this.writeCount<0)return 0;for(var a=this.dbuf,s=this.writePos,o=this.writeCurrent,c=this.writeCount,d=(this.outputsize,this.writeRun);c;){for(c--,n=o,o=255&(s=a[s]),s>>=8,3==d++?(r=o,i=n,o=-1):(r=1,i=o),this.blockCRC.updateCRCRun(i,r);r--;)this.outputStream.writeByte(i),this.nextoutput++;o!=n&&(d=0)}return this.writeCount=c,this.blockCRC.getCRC()!==this.targetBlockCRC&&f(u.DATA_ERROR,"Bad block CRC (got "+this.blockCRC.getCRC().toString(16)+" expected "+this.targetBlockCRC.toString(16)+")"),this.nextoutput};var l=function(e){if("readByte"in e)return e;var t=new i;return t.pos=0,t.readByte=function(){return e[this.pos++]},t.seek=function(e){this.pos=e},t.eof=function(){return this.pos>=e.length},t},h=function(e){var t=new i,r=!0;if(e)if("number"==typeof e)t.buffer=new Uint8Array(e),r=!1;else{if("writeByte"in e)return e;t.buffer=e,r=!1}else t.buffer=new Uint8Array(16384);return t.pos=0,t.writeByte=function(e){if(r&&this.pos>=this.buffer.length){var t=new Uint8Array(2*this.buffer.length);t.set(this.buffer),this.buffer=t}this.buffer[this.pos++]=e},t.getBuffer=function(){if(this.pos!==this.buffer.length){if(!r)throw new TypeError("outputsize does not match decoded input");var e=new Uint8Array(this.pos);e.set(this.buffer.subarray(0,this.pos)),this.buffer=e}return this.buffer},t._coerced=!0,t};d.Err=u,d.decode=function(e,t,r){for(var n=l(e),i=h(t),a=new d(n,i);!("eof"in n&&n.eof());)if(a._init_block())a._read_bunzip();else{var s=a.reader.read(32)>>>0;if(s!==a.streamCRC&&f(u.DATA_ERROR,"Bad stream CRC (got "+a.streamCRC.toString(16)+" expected "+s.toString(16)+")"),!(r&&"eof"in n)||n.eof())break;a._start_bunzip(n,i)}if("getBuffer"in i)return i.getBuffer()},d.decodeBlock=function(e,t,r){var n=l(e),i=h(r),s=new d(n,i);if(s.reader.seek(t),s._get_next_block()&&(s.blockCRC=new a,s.writeCopies=0,s._read_bunzip()),"getBuffer"in i)return i.getBuffer()},d.table=function(e,t,r){var n=new i;n.delegate=l(e),n.pos=0,n.readByte=function(){return this.pos++,this.delegate.readByte()},n.delegate.eof&&(n.eof=n.delegate.eof.bind(n.delegate));var a=new i;a.pos=0,a.writeByte=function(){this.pos++};for(var s=new d(n,a),o=s.dbufSize;!("eof"in n&&n.eof());){var u=8*n.pos+s.reader.bitOffset;if(s.reader.hasByte&&(u-=8),s._init_block()){var c=a.pos;s._read_bunzip(),t(u,a.pos-c)}else{s.reader.read(32);if(!(r&&"eof"in n)||n.eof())break;s._start_bunzip(n,a),console.assert(s.dbufSize===o,"shouldn't change block size within multistream file")}}},d.Stream=i,d.version=s.version,d.license=s.license,t.exports=d},{"../package.json":73,"./bitreader":69,"./crc32":70,"./stream":72}],72:[function(e,t,r){"use strict";var n=function(){};n.prototype.readByte=function(){throw new Error("abstract method readByte() not implemented")},n.prototype.read=function(e,t,r){for(var n=0;n<r;){var i=this.readByte();if(i<0)return 0===n?-1:n;e[t++]=i,n++}return n},n.prototype.seek=function(e){throw new Error("abstract method seek() not implemented")},n.prototype.writeByte=function(e){throw new Error("abstract method readByte() not implemented")},n.prototype.write=function(e,t,r){var n;for(n=0;n<r;n++)this.writeByte(e[t++]);return r},n.prototype.flush=function(){},t.exports=n},{}],73:[function(e,t,r){t.exports={_args:[["github:openpgpjs/seek-bzip#3aca608","/Users/sunny/Desktop/Protonmail/openpgpjs"]],_from:"github:openpgpjs/seek-bzip#3aca608",_id:"seek-bzip@github:openpgpjs/seek-bzip#3aca608ffedc055a1da1d898ecb244804ef32209",_inBundle:!1,_integrity:"",_location:"/seek-bzip",_phantomChildren:{"graceful-readlink":"1.0.1"},_requested:{type:"git",raw:"github:openpgpjs/seek-bzip#3aca608",rawSpec:"github:openpgpjs/seek-bzip#3aca608",saveSpec:"github:openpgpjs/seek-bzip#3aca608",fetchSpec:null,gitCommittish:"3aca608"},_requiredBy:["/"],_resolved:"github:openpgpjs/seek-bzip#3aca608ffedc055a1da1d898ecb244804ef32209",_spec:"github:openpgpjs/seek-bzip#3aca608",_where:"/Users/sunny/Desktop/Protonmail/openpgpjs",bin:{"seek-bunzip":"./bin/seek-bunzip","seek-table":"./bin/seek-bzip-table"},bugs:{url:"https://github.com/cscott/seek-bzip/issues"},contributors:[{name:"C. Scott Ananian",url:"http://cscott.net"},{name:"Eli Skeggs"},{name:"Kevin Kwok"},{name:"Rob Landley",url:"http://landley.net"}],dependencies:{commander:"~2.8.1"},description:"a pure-JavaScript Node.JS module for random-access decoding bzip2 data",devDependencies:{fibers:"~1.0.6",mocha:"~2.2.5"},directories:{test:"test"},homepage:"https://github.com/cscott/seek-bzip#readme",license:"MIT",main:"./lib/index.js",name:"seek-bzip",repository:{type:"git",url:"git+https://github.com/cscott/seek-bzip.git"},scripts:{test:"mocha"},version:"1.0.5-git"}},{}],74:[function(e,t,r){"use strict";function n(e,t,r){return t<=e&&e<=r}function i(e){if(void 0===e)return{};if(e===Object(e))return e;throw TypeError("Could not convert argument to dictionary")}var a=-1;function s(e){this.tokens=[].slice.call(e)}s.prototype={endOfStream:function(){return!this.tokens.length},read:function(){return this.tokens.length?this.tokens.shift():a},prepend:function(e){if(Array.isArray(e))for(var t=e;t.length;)this.tokens.unshift(t.pop());else this.tokens.unshift(e)},push:function(e){if(Array.isArray(e))for(var t=e;t.length;)this.tokens.push(t.shift());else this.tokens.push(e)}};var o=-1;function u(e,t){if(e)throw TypeError("Decoder error");return t||65533}var c="utf-8";function f(e,t){if(!(this instanceof f))return new f(e,t);if((e=void 0!==e?String(e).toLowerCase():c)!==c)throw new Error("Encoding not supported. Only utf-8 is supported");t=i(t),this._streaming=!1,this._BOMseen=!1,this._decoder=null,this._fatal=Boolean(t.fatal),this._ignoreBOM=Boolean(t.ignoreBOM),Object.defineProperty(this,"encoding",{value:"utf-8"}),Object.defineProperty(this,"fatal",{value:this._fatal}),Object.defineProperty(this,"ignoreBOM",{value:this._ignoreBOM})}function d(e,t){if(!(this instanceof d))return new d(e,t);if((e=void 0!==e?String(e).toLowerCase():c)!==c)throw new Error("Encoding not supported. Only utf-8 is supported");t=i(t),this._streaming=!1,this._encoder=null,this._options={fatal:Boolean(t.fatal)},Object.defineProperty(this,"encoding",{value:"utf-8"})}function l(e){var t=e.fatal,r=0,i=0,s=0,c=128,f=191;this.handler=function(e,d){if(d===a&&0!==s)return s=0,u(t);if(d===a)return o;if(0===s){if(n(d,0,127))return d;if(n(d,194,223))s=1,r=d-192;else if(n(d,224,239))224===d&&(c=160),237===d&&(f=159),s=2,r=d-224;else{if(!n(d,240,244))return u(t);240===d&&(c=144),244===d&&(f=143),s=3,r=d-240}return r<<=6*s,null}if(!n(d,c,f))return r=s=i=0,c=128,f=191,e.prepend(d),u(t);if(c=128,f=191,r+=d-128<<6*(s-(i+=1)),i!==s)return null;var l=r;return r=s=i=0,l}}function h(e){e.fatal;this.handler=function(e,t){if(t===a)return o;if(n(t,0,127))return t;var r,i;n(t,128,2047)?(r=1,i=192):n(t,2048,65535)?(r=2,i=224):n(t,65536,1114111)&&(r=3,i=240);for(var s=[(t>>6*r)+i];r>0;){var u=t>>6*(r-1);s.push(128|63&u),r-=1}return s}}f.prototype={decode:function(e,t){var r;r="object"==typeof e&&e instanceof ArrayBuffer?new Uint8Array(e):"object"==typeof e&&"buffer"in e&&e.buffer instanceof ArrayBuffer?new Uint8Array(e.buffer,e.byteOffset,e.byteLength):new Uint8Array(0),t=i(t),this._streaming||(this._decoder=new l({fatal:this._fatal}),this._BOMseen=!1),this._streaming=Boolean(t.stream);for(var n,a=new s(r),u=[];!a.endOfStream()&&(n=this._decoder.handler(a,a.read()))!==o;)null!==n&&(Array.isArray(n)?u.push.apply(u,n):u.push(n));if(!this._streaming){do{if((n=this._decoder.handler(a,a.read()))===o)break;null!==n&&(Array.isArray(n)?u.push.apply(u,n):u.push(n))}while(!a.endOfStream());this._decoder=null}return u.length&&(-1===["utf-8"].indexOf(this.encoding)||this._ignoreBOM||this._BOMseen||(65279===u[0]?(this._BOMseen=!0,u.shift()):this._BOMseen=!0)),function(e){for(var t="",r=0;r<e.length;++r){var n=e[r];n<=65535?t+=String.fromCharCode(n):(n-=65536,t+=String.fromCharCode(55296+(n>>10),56320+(1023&n)))}return t}(u)}},d.prototype={encode:function(e,t){e=e?String(e):"",t=i(t),this._streaming||(this._encoder=new h(this._options)),this._streaming=Boolean(t.stream);for(var r,n=[],a=new s(function(e){for(var t=String(e),r=t.length,n=0,i=[];n<r;){var a=t.charCodeAt(n);if(a<55296||a>57343)i.push(a);else if(56320<=a&&a<=57343)i.push(65533);else if(55296<=a&&a<=56319)if(n===r-1)i.push(65533);else{var s=e.charCodeAt(n+1);if(56320<=s&&s<=57343){var o=1023&a,u=1023&s;i.push(65536+(o<<10)+u),n+=1}else i.push(65533)}n+=1}return i}(e));!a.endOfStream()&&(r=this._encoder.handler(a,a.read()))!==o;)Array.isArray(r)?n.push.apply(n,r):n.push(r);if(!this._streaming){for(;(r=this._encoder.handler(a,a.read()))!==o;)Array.isArray(r)?n.push.apply(n,r):n.push(r);this._encoder=null}return new Uint8Array(n)}},r.TextEncoder=d,r.TextDecoder=f},{}],75:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.webToNode=r.nodeToWeb=void 0;var n,i=e("./streams"),a=(n=i)&&n.__esModule?n:{default:n};const s="undefined"==typeof window&&e("stream").Readable;let o,u;if(s){r.nodeToWeb=o=function(e){return new ReadableStream({start(t){e.pause(),e.on("data",r=>{t.enqueue(r),e.pause()}),e.on("end",()=>t.close()),e.on("error",e=>t.error(e))},pull(){e.resume()},cancel(t){if(e.pause(),e.cancel)return e.cancel(t)}})};class e extends s{constructor(e,t){super(t),this._webStream=e,this._reader=a.default.getReader(e),this._reading=!1,this._doneReadingPromise=Promise.resolve(),this._cancelling=!1}_read(e){if(this._reading||this._cancelling)return;this._reading=!0;this._doneReadingPromise=(async()=>{try{for(;;){var e=await this._reader.read();const t=e.done,r=e.value;if(t){this.push(null);break}if(!this.push(r)||this._cancelling){this._reading=!1;break}}}catch(t){this.emit("error",t)}})()}async cancel(e){return this._cancelling=!0,await this._doneReadingPromise,this._reader.releaseLock(),this._webStream.cancel(e)}}r.webToNode=u=function(t){return new e(t)}}r.nodeToWeb=o,r.webToNode=u},{"./streams":77,stream:"stream"}],76:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.externalBuffer=r.Reader=void 0;var n,i=e("./streams"),a=(n=i)&&n.__esModule?n:{default:n};const s=new WeakSet,o=Symbol("externalBuffer");function u(e){this.stream=e,e[o]&&(this[o]=e[o].slice());let t=a.default.isStream(e);if("node"===t&&(e=a.default.nodeToWeb(e)),t){const t=e.getReader();return this._read=t.read.bind(t),void(this._releaseLock=(()=>{t.closed.catch(function(){}),t.releaseLock()}))}let r=!1;this._read=(async()=>r||s.has(e)?{value:void 0,done:!0}:(r=!0,{value:e,done:!1})),this._releaseLock=(()=>{if(r)try{s.add(e)}catch(t){}})}u.prototype.read=async function(){if(this[o]&&this[o].length){return{done:!1,value:this[o].shift()}}return this._read()},u.prototype.releaseLock=function(){this[o]&&(this.stream[o]=this[o]),this._releaseLock()},u.prototype.readLine=async function(){let e,t=[];for(;!e;){var r=await this.read();let n=r.done,i=r.value;if(i+="",n)return t.length?a.default.concat(t):void 0;const s=i.indexOf("\n")+1;s&&(e=a.default.concat(t.concat(i.substr(0,s))),t=[]),s!==i.length&&t.push(i.substr(s))}return this.unshift(...t),e},u.prototype.readByte=async function(){var e=await this.read();const t=e.done,r=e.value;if(t)return;const n=r[0];return this.unshift(a.default.slice(r,1)),n},u.prototype.readBytes=async function(e){const t=[];let r=0;for(;;){var n=await this.read();const i=n.done,s=n.value;if(i)return t.length?a.default.concat(t):void 0;if(t.push(s),(r+=s.length)>=e){const r=a.default.concat(t);return this.unshift(a.default.slice(r,e)),a.default.slice(r,0,e)}}},u.prototype.peekBytes=async function(e){const t=await this.readBytes(e);return this.unshift(t),t},u.prototype.unshift=function(...e){this[o]||(this[o]=[]),this[o].unshift(...e.filter(e=>e&&e.length))},u.prototype.readToEnd=async function(e=a.default.concat){const t=[];for(;;){var r=await this.read();const e=r.done,n=r.value;if(e)break;t.push(n)}return e(t)},r.Reader=u,r.externalBuffer=o},{"./streams":77}],77:[function(e,t,r){(function(t){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("./util"),i=e("./node-conversions"),a=e("./reader");const s="undefined"==typeof window&&e("buffer").Buffer;function o(e){let t=(0,n.isStream)(e);return"node"===t?(0,i.nodeToWeb)(e):t?e:new ReadableStream({start(t){t.enqueue(e),t.close()}})}function u(e){return e.some(n.isStream)?c(e):"string"==typeof e[0]?e.join(""):s&&s.isBuffer(e[0])?s.concat(e):(0,n.concatUint8Array)(e)}function c(e){e=e.map(o);const t=p(async function(e){await Promise.all(n.map(t=>_(t,e)))});let r=Promise.resolve();const n=e.map((n,i)=>b(n,(n,a)=>r=r.then(()=>l(n,t.writable,{preventClose:i!==e.length-1}))));return t.readable}function f(e){return new a.Reader(e)}function d(e){const t=e.getWriter(),r=t.releaseLock;return t.releaseLock=(()=>{t.closed.catch(function(){}),r.call(t)}),t}async function l(e,t,r){e=o(e);try{if(e[a.externalBuffer]){const r=d(t);for(let t=0;t<e[a.externalBuffer].length;t++)await r.ready,await r.write(e[a.externalBuffer][t]);r.releaseLock()}return await e.pipeTo(t,r)}catch(n){}}function h(e,t){const r=new TransformStream(t);return l(e,r.writable),r.readable}function p(e){let t,r,n=!1;return{readable:new ReadableStream({start(e){r=e},pull(){t?t():n=!0},cancel:e},{highWaterMark:0}),writable:new WritableStream({write:async function(e){r.enqueue(e),n?n=!1:(await new Promise(e=>{t=e}),t=null)},close:r.close.bind(r),abort:r.error.bind(r)})}}function y(e,t=(()=>void 0),r=(()=>void 0)){if((0,n.isStream)(e))return h(e,{async transform(e,r){try{const i=await t(e);void 0!==i&&r.enqueue(i)}catch(n){r.error(n)}},async flush(e){try{const n=await r();void 0!==n&&e.enqueue(n)}catch(t){e.error(t)}}});const i=t(e),a=r();return void 0!==i&&void 0!==a?u([i,a]):void 0!==i?i:a}function b(e,t){let r;const n=new TransformStream({start(e){r=e}}),i=l(e,n.writable),a=p(async function(){r.error(new Error("Readable side was canceled.")),await i,await new Promise(setTimeout)});return t(n.readable,a.writable),a.readable}function m(e,t){Object.entries(Object.getOwnPropertyDescriptors(ReadableStream.prototype)).forEach(([r,n])=>{"constructor"!==r&&(n.value?n.value=n.value.bind(t):n.get=n.get.bind(t),Object.defineProperty(e,r,n))})}function g(e,t=0,r=1/0){if((0,n.isStream)(e)){if(t>=0&&r>=0){let n=0;return h(e,{transform(e,i){n<r?(n+e.length>=t&&i.enqueue(g(e,Math.max(t-n,0),r-n)),n+=e.length):i.terminate()}})}if(t<0&&(r<0||r===1/0)){let n=[];return y(e,e=>{e.length>=-t?n=[e]:n.push(e)},()=>g(u(n),t,r))}if(0===t&&r<0){let n;return y(e,e=>{const i=n?u([n,e]):e;if(i.length>=-r)return n=g(i,r),g(i,t,r);n=i})}return console.warn(`stream.slice(input, ${t}, ${r}) not implemented efficiently.`),v(async()=>g(await w(e),t,r))}return e[a.externalBuffer]&&(e=u(e[a.externalBuffer].concat([e]))),!(0,n.isUint8Array)(e)||s&&s.isBuffer(e)?e.slice(t,r):(r===1/0&&(r=e.length),e.subarray(t,r))}async function w(e,t){return(0,n.isStream)(e)?f(e).readToEnd(t):e}async function _(e,t){if((0,n.isStream)(e)&&e.cancel)return e.cancel(t)}function v(e){return new ReadableStream({pull:async t=>{try{t.enqueue(await e()),t.close()}catch(r){t.error(r)}}})}r.default={isStream:n.isStream,isUint8Array:n.isUint8Array,toStream:o,concatUint8Array:n.concatUint8Array,concatStream:c,concat:u,getReader:f,getWriter:d,pipe:l,transformRaw:h,transform:y,transformPair:b,parse:function(e,t){let r;const n=b(e,(e,i)=>{const a=f(e);a.remainder=(()=>(a.releaseLock(),l(e,i),n)),r=t(a)});return r},clone:function(e){if((0,n.isStream)(e)){const t=function(e){if((0,n.isStream)(e)){const t=o(e).tee();return t[0][a.externalBuffer]=t[1][a.externalBuffer]=e[a.externalBuffer],t}return[g(e),g(e)]}(e);return m(e,t[0]),t[1]}return g(e)},passiveClone:function(e){return(0,n.isStream)(e)?new ReadableStream({start(t){const r=b(e,async(e,r)=>{const n=f(e),i=d(r);try{for(;;){await i.ready;var a=await n.read();const e=a.done,r=a.value;if(e){try{t.close()}catch(s){}return void(await i.close())}try{t.enqueue(r)}catch(s){}await i.write(r)}}catch(s){t.error(s),await i.abort(s)}});m(e,r)}}):g(e)},slice:g,readToEnd:w,cancel:_,fromAsync:v,nodeToWeb:i.nodeToWeb,webToNode:i.webToNode}}).call(this,e("_process"))},{"./node-conversions":75,"./reader":76,"./util":78,_process:68,buffer:"buffer"}],78:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});const n="undefined"==typeof window&&e("stream").Readable;function i(e){return Uint8Array.prototype.isPrototypeOf(e)}r.isStream=function(e){return ReadableStream.prototype.isPrototypeOf(e)?"web":!(!n||!n.prototype.isPrototypeOf(e))&&"node"},r.isUint8Array=i,r.concatUint8Array=function(e){if(1===e.length)return e[0];let t=0;for(let a=0;a<e.length;a++){if(!i(e[a]))throw new Error("concatUint8Array: Data must be in the form of a Uint8Array");t+=e[a].length}const r=new Uint8Array(t);let n=0;return e.forEach(function(e){r.set(e,n),n+=e.length}),r}},{stream:"stream"}],79:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.CleartextMessage=f,r.readArmored=async function(e){const t=await n.default.decode(e);if(t.type!==i.default.armor.signed)throw new Error("No cleartext signed message.");const r=new s.default.List;await r.read(t.data),function(e,t){const r=function(e){const r=e=>t=>e.hashAlgorithm===t;for(let n=0;n<t.length;n++)if(t[n].tag===i.default.packet.signature&&!e.some(r(t[n])))return!1;return!0};let n=null,a=[];if(e.forEach(function(e){if(!(n=e.match(/Hash: (.+)/)))throw new Error('Only "Hash" header allowed in cleartext signed message');n=(n=(n=n[1].replace(/\s/g,"")).split(",")).map(function(e){e=e.toLowerCase();try{return i.default.write(i.default.hash,e)}catch(t){throw new Error("Unknown hash algorithm in armor header: "+e)}}),a=a.concat(n)}),!a.length&&!r([i.default.hash.md5]))throw new Error('If no "Hash" header in cleartext signed message, then only MD5 signatures allowed');if(a.length&&!r(a))throw new Error("Hash algorithm mismatch in armor header and signature")}(t.headers,r);const a=new o.Signature(r);return new f(t.text,a)},r.fromText=function(e){return new f(e)};var n=c(e("./encoding/armor")),i=c(e("./enums")),a=c(e("./util")),s=c(e("./packet")),o=e("./signature"),u=e("./message");function c(e){return e&&e.__esModule?e:{default:e}}function f(e,t){if(!(this instanceof f))return new f(e,t);if(this.text=a.default.canonicalizeEOL(a.default.removeTrailingSpaces(e)),t&&!(t instanceof o.Signature))throw new Error("Invalid signature input");this.signature=t||new o.Signature(new s.default.List)}f.prototype.getSigningKeyIds=function(){const e=[];return this.signature.packets.forEach(function(t){e.push(t.issuerKeyId)}),e},f.prototype.sign=async function(e,t=null,r=new Date,n=[]){return new f(this.text,await this.signDetached(e,t,r,n))},f.prototype.signDetached=async function(e,t=null,r=new Date,n=[]){const i=new s.default.Literal;return i.setText(this.text),new o.Signature(await(0,u.createSignaturePackets)(i,e,t,r,n))},f.prototype.verify=function(e,t=new Date){return this.verifyDetached(this.signature,e,t)},f.prototype.verifyDetached=function(e,t,r=new Date){const n=e.packets,i=new s.default.Literal;return i.setText(this.text),(0,u.createVerificationObjects)(n,[i],t,r)},f.prototype.getText=function(){return a.default.nativeEOL(this.text)},f.prototype.armor=function(){let e=this.signature.packets.map(function(e){return i.default.read(i.default.hash,e.hashAlgorithm).toUpperCase()});const t={hash:(e=e.filter(function(e,t,r){return r.indexOf(e)===t})).join(),text:this.text,data:this.signature.packets.write()};return n.default.encode(i.default.armor.signed,t)}},{"./encoding/armor":113,"./enums":115,"./message":122,"./packet":127,"./signature":147,"./util":154}],80:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../enums"),a=(n=i)&&n.__esModule?n:{default:n};r.default={prefer_hash_algorithm:a.default.hash.sha256,encryption_cipher:a.default.symmetric.aes256,compression:a.default.compression.uncompressed,deflate_level:6,aead_protect:!1,aead_protect_version:4,aead_mode:a.default.aead.eax,aead_chunk_size_byte:12,s2k_iteration_count_byte:224,integrity_protect:!0,ignore_mdc_error:!1,allow_unauthenticated_stream:!1,checksum_required:!1,rsa_blinding:!0,password_collision_check:!1,revocations_expire:!1,use_native:!0,min_bytes_for_web_crypto:1e3,zero_copy:!1,debug:!1,tolerant:!0,show_version:!0,show_comment:!0,versionstring:"OpenPGP.js v4.4.7",commentstring:"https://openpgpjs.org",keyserver:"https://keyserver.ubuntu.com",node_store:"./openpgp.store",max_userid_length:5120}},{"../enums":115}],81:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("./config.js");Object.defineProperty(r,"default",{enumerable:!0,get:function(){return(e=n,e&&e.__esModule?e:{default:e}).default;var e}})},{"./config.js":80}],82:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("./cipher")),i=a(e("../util"));function a(e){return e&&e.__esModule?e:{default:e}}function s(e){const t=e.length,r=function(e){if(i.default.isString(e)){const t=e.length,r=new ArrayBuffer(t),n=new Uint8Array(r);for(let i=0;i<t;++i)n[i]=e.charCodeAt(i);return r}return new Uint8Array(e).buffer}(e),n=new DataView(r),a=new Uint32Array(t/4);for(let i=0;i<t/4;++i)a[i]=n.getUint32(4*i);return a}function o(){let e=0;for(let i=0;i<arguments.length;++i)e+=4*arguments[i].length;const t=new ArrayBuffer(e),r=new DataView(t);let n=0;for(let i=0;i<arguments.length;++i){for(let e=0;e<arguments[i].length;++e)r.setUint32(n+4*e,arguments[i][e]);n+=4*arguments[i].length}return new Uint8Array(t)}r.default={wrap:function(e,t){const r=new n.default["aes"+8*e.length](e),i=new Uint32Array([2795939494,2795939494]),a=s(t);let u=i;const c=a,f=a.length/2,d=new Uint32Array([0,0]);let l=new Uint32Array(4);for(let n=0;n<=5;++n)for(let e=0;e<f;++e)d[1]=f*n+(1+e),l[0]=u[0],l[1]=u[1],l[2]=c[2*e],l[3]=c[2*e+1],(u=(l=s(r.encrypt(o(l)))).subarray(0,2))[0]^=d[0],u[1]^=d[1],c[2*e]=l[2],c[2*e+1]=l[3];return o(u,c)},unwrap:function(e,t){const r=new n.default["aes"+8*e.length](e),i=new Uint32Array([2795939494,2795939494]),a=s(t);let u=a.subarray(0,2);const c=a.subarray(2),f=a.length/2-1,d=new Uint32Array([0,0]);let l=new Uint32Array(4);for(let n=5;n>=0;--n)for(let e=f-1;e>=0;--e)d[1]=f*n+(e+1),l[0]=u[0]^d[0],l[1]=u[1]^d[1],l[2]=c[2*e],l[3]=c[2*e+1],u=(l=s(r.decrypt(o(l)))).subarray(0,2),c[2*e]=l[2],c[2*e+1]=l[3];if(u[0]===i[0]&&u[1]===i[1])return o(c);throw new Error("Key Data Integrity failed")}}},{"../util":154,"./cipher":88}],83:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("asmcrypto.js/dist_es5/aes/cfb"),i=u(e("web-stream-tools")),a=u(e("./cipher")),s=u(e("../config")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}const c=o.default.getWebCrypto(),f=o.default.getNodeCrypto(),d=o.default.getNodeBuffer();r.default={encrypt:function(e,t,r,u){if("aes"===e.substr(0,3))return function(e,t,r,u){if(o.default.getWebCrypto()&&24!==t.length&&!o.default.isStream(r)&&r.length>=3e3*s.default.min_bytes_for_web_crypto)return async function(e,t,r,n){const i=await c.importKey("raw",t,{name:"AES-CBC"},!1,["encrypt"]),s=a.default[e].blockSize,u=o.default.concatUint8Array([new Uint8Array(s),r]),f=new Uint8Array(await c.encrypt({name:"AES-CBC",iv:n},i,u)).subarray(0,r.length);return function(e,t){for(let r=0;r<e.length;r++)e[r]=e[r]^t[r]}(f,r),f}(e,t,r,u);if(f)return function(e,t,r,n){t=new d(t),n=new d(n);const a=new f.createCipheriv("aes-"+e.substr(3,3)+"-cfb",t,n);return i.default.transform(r,e=>new Uint8Array(a.update(new d(e))))}(e,t,r,u);const l=new n.AES_CFB(t,u);return i.default.transform(r,e=>l.AES_Encrypt_process(e),()=>l.AES_Encrypt_finish())}(e,t,r,u);const l=new a.default[e](t),h=l.blockSize;let p=new Uint8Array(h);const y=u;let b=0;const m=new Uint8Array(r.length);let g,w=0;for(;r.length>h*b;){const e=l.encrypt(y);for(p=r.subarray(b*h,b*h+h),g=0;g<p.length;g++)y[g]=p[g]^e[g],m[w++]=y[g];b++}return m},decrypt:async function(e,t,r,s){if("aes"===e.substr(0,3))return function(e,t,r,a){if(f)return function(e,t,r,n){t=new d(t),n=new d(n);const a=new f.createDecipheriv("aes-"+e.substr(3,3)+"-cfb",t,n);return i.default.transform(r,e=>new Uint8Array(a.update(new d(e))))}(e,t,r,a);if(o.default.isStream(r)){const e=new n.AES_CFB(t,a);return i.default.transform(r,t=>e.AES_Decrypt_process(t),()=>e.AES_Decrypt_finish())}return n.AES_CFB.decrypt(r,t,a)}(e,t,r,s);r=await i.default.readToEnd(r);const u=new a.default[e](t),c=u.blockSize;let l=s,h=0;const p=new Uint8Array(r.length);let y,b=0;for(;r.length>c*h;){const e=u.encrypt(l);for(l=r.subarray(h*c+0,h*c+c+0),y=0;y<l.length;y++)p[b++]=l[y]^e[y];h++}return p}}},{"../config":81,"../util":154,"./cipher":88,"asmcrypto.js/dist_es5/aes/cfb":6,"web-stream-tools":77}],84:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("asmcrypto.js/dist_es5/aes/ecb");r.default=function(e){const t=function(e){const t=new n.AES_ECB(e);this.encrypt=function(e){return t.encrypt(e)},this.decrypt=function(e){return t.decrypt(e)}};return t.blockSize=t.prototype.blockSize=16,t.keySize=t.prototype.keySize=e/8,t}},{"asmcrypto.js/dist_es5/aes/ecb":8}],85:[function(e,t,r){"use strict";function n(){}function i(e){this.bf=new n,this.bf.init(e),this.encrypt=function(e){return this.bf.encrypt_block(e)}}Object.defineProperty(r,"__esModule",{value:!0}),n.prototype.BLOCKSIZE=8,n.prototype.SBOXES=[[3509652390,2564797868,805139163,3491422135,3101798381,1780907670,3128725573,4046225305,614570311,3012652279,134345442,2240740374,1667834072,1901547113,2757295779,4103290238,227898511,1921955416,1904987480,2182433518,2069144605,3260701109,2620446009,720527379,3318853667,677414384,3393288472,3101374703,2390351024,1614419982,1822297739,2954791486,3608508353,3174124327,2024746970,1432378464,3864339955,2857741204,1464375394,1676153920,1439316330,715854006,3033291828,289532110,2706671279,2087905683,3018724369,1668267050,732546397,1947742710,3462151702,2609353502,2950085171,1814351708,2050118529,680887927,999245976,1800124847,3300911131,1713906067,1641548236,4213287313,1216130144,1575780402,4018429277,3917837745,3693486850,3949271944,596196993,3549867205,258830323,2213823033,772490370,2760122372,1774776394,2652871518,566650946,4142492826,1728879713,2882767088,1783734482,3629395816,2517608232,2874225571,1861159788,326777828,3124490320,2130389656,2716951837,967770486,1724537150,2185432712,2364442137,1164943284,2105845187,998989502,3765401048,2244026483,1075463327,1455516326,1322494562,910128902,469688178,1117454909,936433444,3490320968,3675253459,1240580251,122909385,2157517691,634681816,4142456567,3825094682,3061402683,2540495037,79693498,3249098678,1084186820,1583128258,426386531,1761308591,1047286709,322548459,995290223,1845252383,2603652396,3431023940,2942221577,3202600964,3727903485,1712269319,422464435,3234572375,1170764815,3523960633,3117677531,1434042557,442511882,3600875718,1076654713,1738483198,4213154764,2393238008,3677496056,1014306527,4251020053,793779912,2902807211,842905082,4246964064,1395751752,1040244610,2656851899,3396308128,445077038,3742853595,3577915638,679411651,2892444358,2354009459,1767581616,3150600392,3791627101,3102740896,284835224,4246832056,1258075500,768725851,2589189241,3069724005,3532540348,1274779536,3789419226,2764799539,1660621633,3471099624,4011903706,913787905,3497959166,737222580,2514213453,2928710040,3937242737,1804850592,3499020752,2949064160,2386320175,2390070455,2415321851,4061277028,2290661394,2416832540,1336762016,1754252060,3520065937,3014181293,791618072,3188594551,3933548030,2332172193,3852520463,3043980520,413987798,3465142937,3030929376,4245938359,2093235073,3534596313,375366246,2157278981,2479649556,555357303,3870105701,2008414854,3344188149,4221384143,3956125452,2067696032,3594591187,2921233993,2428461,544322398,577241275,1471733935,610547355,4027169054,1432588573,1507829418,2025931657,3646575487,545086370,48609733,2200306550,1653985193,298326376,1316178497,3007786442,2064951626,458293330,2589141269,3591329599,3164325604,727753846,2179363840,146436021,1461446943,4069977195,705550613,3059967265,3887724982,4281599278,3313849956,1404054877,2845806497,146425753,1854211946],[1266315497,3048417604,3681880366,3289982499,290971e4,1235738493,2632868024,2414719590,3970600049,1771706367,1449415276,3266420449,422970021,1963543593,2690192192,3826793022,1062508698,1531092325,1804592342,2583117782,2714934279,4024971509,1294809318,4028980673,1289560198,2221992742,1669523910,35572830,157838143,1052438473,1016535060,1802137761,1753167236,1386275462,3080475397,2857371447,1040679964,2145300060,2390574316,1461121720,2956646967,4031777805,4028374788,33600511,2920084762,1018524850,629373528,3691585981,3515945977,2091462646,2486323059,586499841,988145025,935516892,3367335476,2599673255,2839830854,265290510,3972581182,2759138881,3795373465,1005194799,847297441,406762289,1314163512,1332590856,1866599683,4127851711,750260880,613907577,1450815602,3165620655,3734664991,3650291728,3012275730,3704569646,1427272223,778793252,1343938022,2676280711,2052605720,1946737175,3164576444,3914038668,3967478842,3682934266,1661551462,3294938066,4011595847,840292616,3712170807,616741398,312560963,711312465,1351876610,322626781,1910503582,271666773,2175563734,1594956187,70604529,3617834859,1007753275,1495573769,4069517037,2549218298,2663038764,504708206,2263041392,3941167025,2249088522,1514023603,1998579484,1312622330,694541497,2582060303,2151582166,1382467621,776784248,2618340202,3323268794,2497899128,2784771155,503983604,4076293799,907881277,423175695,432175456,1378068232,4145222326,3954048622,3938656102,3820766613,2793130115,2977904593,26017576,3274890735,3194772133,1700274565,1756076034,4006520079,3677328699,720338349,1533947780,354530856,688349552,3973924725,1637815568,332179504,3949051286,53804574,2852348879,3044236432,1282449977,3583942155,3416972820,4006381244,1617046695,2628476075,3002303598,1686838959,431878346,2686675385,1700445008,1080580658,1009431731,832498133,3223435511,2605976345,2271191193,2516031870,1648197032,4164389018,2548247927,300782431,375919233,238389289,3353747414,2531188641,2019080857,1475708069,455242339,2609103871,448939670,3451063019,1395535956,2413381860,1841049896,1491858159,885456874,4264095073,4001119347,1565136089,3898914787,1108368660,540939232,1173283510,2745871338,3681308437,4207628240,3343053890,4016749493,1699691293,1103962373,3625875870,2256883143,3830138730,1031889488,3479347698,1535977030,4236805024,3251091107,2132092099,1774941330,1199868427,1452454533,157007616,2904115357,342012276,595725824,1480756522,206960106,497939518,591360097,863170706,2375253569,3596610801,1814182875,2094937945,3421402208,1082520231,3463918190,2785509508,435703966,3908032597,1641649973,2842273706,3305899714,1510255612,2148256476,2655287854,3276092548,4258621189,236887753,3681803219,274041037,1734335097,3815195456,3317970021,1899903192,1026095262,4050517792,356393447,2410691914,3873677099,3682840055],[3913112168,2491498743,4132185628,2489919796,1091903735,1979897079,3170134830,3567386728,3557303409,857797738,1136121015,1342202287,507115054,2535736646,337727348,3213592640,1301675037,2528481711,1895095763,1721773893,3216771564,62756741,2142006736,835421444,2531993523,1442658625,3659876326,2882144922,676362277,1392781812,170690266,3921047035,1759253602,3611846912,1745797284,664899054,1329594018,3901205900,3045908486,2062866102,2865634940,3543621612,3464012697,1080764994,553557557,3656615353,3996768171,991055499,499776247,1265440854,648242737,3940784050,980351604,3713745714,1749149687,3396870395,4211799374,3640570775,1161844396,3125318951,1431517754,545492359,4268468663,3499529547,1437099964,2702547544,3433638243,2581715763,2787789398,1060185593,1593081372,2418618748,4260947970,69676912,2159744348,86519011,2512459080,3838209314,1220612927,3339683548,133810670,1090789135,1078426020,1569222167,845107691,3583754449,4072456591,1091646820,628848692,1613405280,3757631651,526609435,236106946,48312990,2942717905,3402727701,1797494240,859738849,992217954,4005476642,2243076622,3870952857,3732016268,765654824,3490871365,2511836413,1685915746,3888969200,1414112111,2273134842,3281911079,4080962846,172450625,2569994100,980381355,4109958455,2819808352,2716589560,2568741196,3681446669,3329971472,1835478071,660984891,3704678404,4045999559,3422617507,3040415634,1762651403,1719377915,3470491036,2693910283,3642056355,3138596744,1364962596,2073328063,1983633131,926494387,3423689081,2150032023,4096667949,1749200295,3328846651,309677260,2016342300,1779581495,3079819751,111262694,1274766160,443224088,298511866,1025883608,3806446537,1145181785,168956806,3641502830,3584813610,1689216846,3666258015,3200248200,1692713982,2646376535,4042768518,1618508792,1610833997,3523052358,4130873264,2001055236,3610705100,2202168115,4028541809,2961195399,1006657119,2006996926,3186142756,1430667929,3210227297,1314452623,4074634658,4101304120,2273951170,1399257539,3367210612,3027628629,1190975929,2062231137,2333990788,2221543033,2438960610,1181637006,548689776,2362791313,3372408396,3104550113,3145860560,296247880,1970579870,3078560182,3769228297,1714227617,3291629107,3898220290,166772364,1251581989,493813264,448347421,195405023,2709975567,677966185,3703036547,1463355134,2715995803,1338867538,1343315457,2802222074,2684532164,233230375,2599980071,2000651841,3277868038,1638401717,4028070440,3237316320,6314154,819756386,300326615,590932579,1405279636,3267499572,3150704214,2428286686,3959192993,3461946742,1862657033,1266418056,963775037,2089974820,2263052895,1917689273,448879540,3550394620,3981727096,150775221,3627908307,1303187396,508620638,2975983352,2726630617,1817252668,1876281319,1457606340,908771278,3720792119,3617206836,2455994898,1729034894,1080033504],[976866871,3556439503,2881648439,1522871579,1555064734,1336096578,3548522304,2579274686,3574697629,3205460757,3593280638,3338716283,3079412587,564236357,2993598910,1781952180,1464380207,3163844217,3332601554,1699332808,1393555694,1183702653,3581086237,1288719814,691649499,2847557200,2895455976,3193889540,2717570544,1781354906,1676643554,2592534050,3230253752,1126444790,2770207658,2633158820,2210423226,2615765581,2414155088,3127139286,673620729,2805611233,1269405062,4015350505,3341807571,4149409754,1057255273,2012875353,2162469141,2276492801,2601117357,993977747,3918593370,2654263191,753973209,36408145,2530585658,25011837,3520020182,2088578344,530523599,2918365339,1524020338,1518925132,3760827505,3759777254,1202760957,3985898139,3906192525,674977740,4174734889,2031300136,2019492241,3983892565,4153806404,3822280332,352677332,2297720250,60907813,90501309,3286998549,1016092578,2535922412,2839152426,457141659,509813237,4120667899,652014361,1966332200,2975202805,55981186,2327461051,676427537,3255491064,2882294119,3433927263,1307055953,942726286,933058658,2468411793,3933900994,4215176142,1361170020,2001714738,2830558078,3274259782,1222529897,1679025792,2729314320,3714953764,1770335741,151462246,3013232138,1682292957,1483529935,471910574,1539241949,458788160,3436315007,1807016891,3718408830,978976581,1043663428,3165965781,1927990952,4200891579,2372276910,3208408903,3533431907,1412390302,2931980059,4132332400,1947078029,3881505623,4168226417,2941484381,1077988104,1320477388,886195818,18198404,3786409e3,2509781533,112762804,3463356488,1866414978,891333506,18488651,661792760,1628790961,3885187036,3141171499,876946877,2693282273,1372485963,791857591,2686433993,3759982718,3167212022,3472953795,2716379847,445679433,3561995674,3504004811,3574258232,54117162,3331405415,2381918588,3769707343,4154350007,1140177722,4074052095,668550556,3214352940,367459370,261225585,2610173221,4209349473,3468074219,3265815641,314222801,3066103646,3808782860,282218597,3406013506,3773591054,379116347,1285071038,846784868,2669647154,3771962079,3550491691,2305946142,453669953,1268987020,3317592352,3279303384,3744833421,2610507566,3859509063,266596637,3847019092,517658769,3462560207,3443424879,370717030,4247526661,2224018117,4143653529,4112773975,2788324899,2477274417,1456262402,2901442914,1517677493,1846949527,2295493580,3734397586,2176403920,1280348187,1908823572,3871786941,846861322,1172426758,3287448474,3383383037,1655181056,3139813346,901632758,1897031941,2986607138,3066810236,3447102507,1393639104,373351379,950779232,625454576,3124240540,4148612726,2007998917,544563296,2244738638,2330496472,2058025392,1291430526,424198748,50039436,29584100,3605783033,2429876329,2791104160,1057563949,3255363231,3075367218,3463963227,1469046755,985887462]],n.prototype.PARRAY=[608135816,2242054355,320440878,57701188,2752067618,698298832,137296536,3964562569,1160258022,953160567,3193202383,887688300,3232508343,3380367581,1065670069,3041331479,2450970073,2306472731],n.prototype.NN=16,n.prototype._clean=function(e){if(e<0){e=(2147483647&e)+2147483648}return e},n.prototype._F=function(e){let t;const r=255&e,n=255&(e>>>=8),i=255&(e>>>=8),a=255&(e>>>=8);return t=this.sboxes[0][a]+this.sboxes[1][i],t^=this.sboxes[2][n],t+=this.sboxes[3][r]},n.prototype._encrypt_block=function(e){let t,r=e[0],n=e[1];for(t=0;t<this.NN;++t){const e=r^=this.parray[t];r=n=this._F(r)^n,n=e}r^=this.parray[this.NN+0],n^=this.parray[this.NN+1],e[0]=this._clean(n),e[1]=this._clean(r)},n.prototype.encrypt_block=function(e){let t;const r=[0,0],n=this.BLOCKSIZE/2;for(t=0;t<this.BLOCKSIZE/2;++t)r[0]=r[0]<<8|255&e[t+0],r[1]=r[1]<<8|255&e[t+n];this._encrypt_block(r);const i=[];for(t=0;t<this.BLOCKSIZE/2;++t)i[t+0]=r[0]>>>24-8*t&255,i[t+n]=r[1]>>>24-8*t&255;return i},n.prototype._decrypt_block=function(e){let t,r=e[0],n=e[1];for(t=this.NN+1;t>1;--t){const e=r^=this.parray[t];r=n=this._F(r)^n,n=e}r^=this.parray[1],n^=this.parray[0],e[0]=this._clean(n),e[1]=this._clean(r)},n.prototype.init=function(e){let t,r=0;for(this.parray=[],t=0;t<this.NN+2;++t){let n=0;for(let t=0;t<4;++t)n=n<<8|255&e[r],++r>=e.length&&(r=0);this.parray[t]=this.PARRAY[t]^n}for(this.sboxes=[],t=0;t<4;++t)for(this.sboxes[t]=[],r=0;r<256;++r)this.sboxes[t][r]=this.SBOXES[t][r];const n=[0,0];for(t=0;t<this.NN+2;t+=2)this._encrypt_block(n),this.parray[t+0]=n[0],this.parray[t+1]=n[1];for(t=0;t<4;++t)for(r=0;r<256;r+=2)this._encrypt_block(n),this.sboxes[t][r+0]=n[0],this.sboxes[t][r+1]=n[1]},i.keySize=i.prototype.keySize=16,i.blockSize=i.prototype.blockSize=16,r.default=i},{}],86:[function(e,t,r){"use strict";function n(){this.BlockSize=8,this.KeySize=16,this.setKey=function(e){if(this.masking=new Array(16),this.rotate=new Array(16),this.reset(),e.length!==this.KeySize)throw new Error("CAST-128: keys must be 16 bytes");return this.keySchedule(e),!0},this.reset=function(){for(let e=0;e<16;e++)this.masking[e]=0,this.rotate[e]=0},this.getBlockSize=function(){return this.BlockSize},this.encrypt=function(e){const t=new Array(e.length);for(let a=0;a<e.length;a+=8){let s,o=e[a]<<24|e[a+1]<<16|e[a+2]<<8|e[a+3],u=e[a+4]<<24|e[a+5]<<16|e[a+6]<<8|e[a+7];s=u,u=o^r(u,this.masking[0],this.rotate[0]),o=s,s=u,u=o^n(u,this.masking[1],this.rotate[1]),o=s,s=u,u=o^i(u,this.masking[2],this.rotate[2]),o=s,s=u,u=o^r(u,this.masking[3],this.rotate[3]),o=s,s=u,u=o^n(u,this.masking[4],this.rotate[4]),o=s,s=u,u=o^i(u,this.masking[5],this.rotate[5]),o=s,s=u,u=o^r(u,this.masking[6],this.rotate[6]),o=s,s=u,u=o^n(u,this.masking[7],this.rotate[7]),o=s,s=u,u=o^i(u,this.masking[8],this.rotate[8]),o=s,s=u,u=o^r(u,this.masking[9],this.rotate[9]),o=s,s=u,u=o^n(u,this.masking[10],this.rotate[10]),o=s,s=u,u=o^i(u,this.masking[11],this.rotate[11]),o=s,s=u,u=o^r(u,this.masking[12],this.rotate[12]),o=s,s=u,u=o^n(u,this.masking[13],this.rotate[13]),o=s,s=u,u=o^i(u,this.masking[14],this.rotate[14]),o=s,s=u,u=o^r(u,this.masking[15],this.rotate[15]),o=s,t[a]=u>>>24&255,t[a+1]=u>>>16&255,t[a+2]=u>>>8&255,t[a+3]=255&u,t[a+4]=o>>>24&255,t[a+5]=o>>>16&255,t[a+6]=o>>>8&255,t[a+7]=255&o}return t},this.decrypt=function(e){const t=new Array(e.length);for(let a=0;a<e.length;a+=8){let s,o=e[a]<<24|e[a+1]<<16|e[a+2]<<8|e[a+3],u=e[a+4]<<24|e[a+5]<<16|e[a+6]<<8|e[a+7];s=u,u=o^r(u,this.masking[15],this.rotate[15]),o=s,s=u,u=o^i(u,this.masking[14],this.rotate[14]),o=s,s=u,u=o^n(u,this.masking[13],this.rotate[13]),o=s,s=u,u=o^r(u,this.masking[12],this.rotate[12]),o=s,s=u,u=o^i(u,this.masking[11],this.rotate[11]),o=s,s=u,u=o^n(u,this.masking[10],this.rotate[10]),o=s,s=u,u=o^r(u,this.masking[9],this.rotate[9]),o=s,s=u,u=o^i(u,this.masking[8],this.rotate[8]),o=s,s=u,u=o^n(u,this.masking[7],this.rotate[7]),o=s,s=u,u=o^r(u,this.masking[6],this.rotate[6]),o=s,s=u,u=o^i(u,this.masking[5],this.rotate[5]),o=s,s=u,u=o^n(u,this.masking[4],this.rotate[4]),o=s,s=u,u=o^r(u,this.masking[3],this.rotate[3]),o=s,s=u,u=o^i(u,this.masking[2],this.rotate[2]),o=s,s=u,u=o^n(u,this.masking[1],this.rotate[1]),o=s,s=u,u=o^r(u,this.masking[0],this.rotate[0]),o=s,t[a]=u>>>24&255,t[a+1]=u>>>16&255,t[a+2]=u>>>8&255,t[a+3]=255&u,t[a+4]=o>>>24&255,t[a+5]=o>>16&255,t[a+6]=o>>8&255,t[a+7]=255&o}return t};const e=new Array(4);e[0]=new Array(4),e[0][0]=[4,0,13,15,12,14,8],e[0][1]=[5,2,16,18,17,19,10],e[0][2]=[6,3,23,22,21,20,9],e[0][3]=[7,1,26,25,27,24,11],e[1]=new Array(4),e[1][0]=[0,6,21,23,20,22,16],e[1][1]=[1,4,0,2,1,3,18],e[1][2]=[2,5,7,6,5,4,17],e[1][3]=[3,7,10,9,11,8,19],e[2]=new Array(4),e[2][0]=[4,0,13,15,12,14,8],e[2][1]=[5,2,16,18,17,19,10],e[2][2]=[6,3,23,22,21,20,9],e[2][3]=[7,1,26,25,27,24,11],e[3]=new Array(4),e[3][0]=[0,6,21,23,20,22,16],e[3][1]=[1,4,0,2,1,3,18],e[3][2]=[2,5,7,6,5,4,17],e[3][3]=[3,7,10,9,11,8,19];const t=new Array(4);function r(e,t,r){const n=t+e,i=n<<r|n>>>32-r;return(a[0][i>>>24]^a[1][i>>>16&255])-a[2][i>>>8&255]+a[3][255&i]}function n(e,t,r){const n=t^e,i=n<<r|n>>>32-r;return a[0][i>>>24]-a[1][i>>>16&255]+a[2][i>>>8&255]^a[3][255&i]}function i(e,t,r){const n=t-e,i=n<<r|n>>>32-r;return(a[0][i>>>24]+a[1][i>>>16&255]^a[2][i>>>8&255])-a[3][255&i]}t[0]=new Array(4),t[0][0]=[24,25,23,22,18],t[0][1]=[26,27,21,20,22],t[0][2]=[28,29,19,18,25],t[0][3]=[30,31,17,16,28],t[1]=new Array(4),t[1][0]=[3,2,12,13,8],t[1][1]=[1,0,14,15,13],t[1][2]=[7,6,8,9,3],t[1][3]=[5,4,10,11,7],t[2]=new Array(4),t[2][0]=[19,18,28,29,25],t[2][1]=[17,16,30,31,28],t[2][2]=[23,22,24,25,18],t[2][3]=[21,20,26,27,22],t[3]=new Array(4),t[3][0]=[8,9,7,6,3],t[3][1]=[10,11,5,4,7],t[3][2]=[12,13,3,2,8],t[3][3]=[14,15,1,0,13],this.keySchedule=function(r){const n=new Array(8),i=new Array(32);let s;for(let e=0;e<4;e++)s=4*e,n[e]=r[s]<<24|r[s+1]<<16|r[s+2]<<8|r[s+3];const o=[6,7,4,5];let u,c=0;for(let f=0;f<2;f++)for(let r=0;r<4;r++){for(s=0;s<4;s++){const t=e[r][s];u=n[t[1]],u^=a[4][n[t[2]>>>2]>>>24-8*(3&t[2])&255],u^=a[5][n[t[3]>>>2]>>>24-8*(3&t[3])&255],u^=a[6][n[t[4]>>>2]>>>24-8*(3&t[4])&255],u^=a[7][n[t[5]>>>2]>>>24-8*(3&t[5])&255],u^=a[o[s]][n[t[6]>>>2]>>>24-8*(3&t[6])&255],n[t[0]]=u}for(s=0;s<4;s++){const e=t[r][s];u=a[4][n[e[0]>>>2]>>>24-8*(3&e[0])&255],u^=a[5][n[e[1]>>>2]>>>24-8*(3&e[1])&255],u^=a[6][n[e[2]>>>2]>>>24-8*(3&e[2])&255],u^=a[7][n[e[3]>>>2]>>>24-8*(3&e[3])&255],u^=a[4+s][n[e[4]>>>2]>>>24-8*(3&e[4])&255],i[c]=u,c++}}for(let e=0;e<16;e++)this.masking[e]=i[e],this.rotate[e]=31&i[16+e]};const a=new Array(8);a[0]=[821772500,2678128395,1810681135,1059425402,505495343,2617265619,1610868032,3483355465,3218386727,2294005173,3791863952,2563806837,1852023008,365126098,3269944861,584384398,677919599,3229601881,4280515016,2002735330,1136869587,3744433750,2289869850,2731719981,2714362070,879511577,1639411079,575934255,717107937,2857637483,576097850,2731753936,1725645e3,2810460463,5111599,767152862,2543075244,1251459544,1383482551,3052681127,3089939183,3612463449,1878520045,1510570527,2189125840,2431448366,582008916,3163445557,1265446783,1354458274,3529918736,3202711853,3073581712,3912963487,3029263377,1275016285,4249207360,2905708351,3304509486,1442611557,3585198765,2712415662,2731849581,3248163920,2283946226,208555832,2766454743,1331405426,1447828783,3315356441,3108627284,2957404670,2981538698,3339933917,1669711173,286233437,1465092821,1782121619,3862771680,710211251,980974943,1651941557,430374111,2051154026,704238805,4128970897,3144820574,2857402727,948965521,3333752299,2227686284,718756367,2269778983,2731643755,718440111,2857816721,3616097120,1113355533,2478022182,410092745,1811985197,1944238868,2696854588,1415722873,1682284203,1060277122,1998114690,1503841958,82706478,2315155686,1068173648,845149890,2167947013,1768146376,1993038550,3566826697,3390574031,940016341,3355073782,2328040721,904371731,1205506512,4094660742,2816623006,825647681,85914773,2857843460,1249926541,1417871568,3287612,3211054559,3126306446,1975924523,1353700161,2814456437,2438597621,1800716203,722146342,2873936343,1151126914,4160483941,2877670899,458611604,2866078500,3483680063,770352098,2652916994,3367839148,3940505011,3585973912,3809620402,718646636,2504206814,2914927912,3631288169,2857486607,2860018678,575749918,2857478043,718488780,2069512688,3548183469,453416197,1106044049,3032691430,52586708,3378514636,3459808877,3211506028,1785789304,218356169,3571399134,3759170522,1194783844,1523787992,3007827094,1975193539,2555452411,1341901877,3045838698,3776907964,3217423946,2802510864,2889438986,1057244207,1636348243,3761863214,1462225785,2632663439,481089165,718503062,24497053,3332243209,3344655856,3655024856,3960371065,1195698900,2971415156,3710176158,2115785917,4027663609,3525578417,2524296189,2745972565,3564906415,1372086093,1452307862,2780501478,1476592880,3389271281,18495466,2378148571,901398090,891748256,3279637769,3157290713,2560960102,1447622437,4284372637,216884176,2086908623,1879786977,3588903153,2242455666,2938092967,3559082096,2810645491,758861177,1121993112,215018983,642190776,4169236812,1196255959,2081185372,3508738393,941322904,4124243163,2877523539,1848581667,2205260958,3180453958,2589345134,3694731276,550028657,2519456284,3789985535,2973870856,2093648313,443148163,46942275,2734146937,1117713533,1115362972,1523183689,3717140224,1551984063],a[1]=[522195092,4010518363,1776537470,960447360,4267822970,4005896314,1435016340,1929119313,2913464185,1310552629,3579470798,3724818106,2579771631,1594623892,417127293,2715217907,2696228731,1508390405,3994398868,3925858569,3695444102,4019471449,3129199795,3770928635,3520741761,990456497,4187484609,2783367035,21106139,3840405339,631373633,3783325702,532942976,396095098,3548038825,4267192484,2564721535,2011709262,2039648873,620404603,3776170075,2898526339,3612357925,4159332703,1645490516,223693667,1567101217,3362177881,1029951347,3470931136,3570957959,1550265121,119497089,972513919,907948164,3840628539,1613718692,3594177948,465323573,2659255085,654439692,2575596212,2699288441,3127702412,277098644,624404830,4100943870,2717858591,546110314,2403699828,3655377447,1321679412,4236791657,1045293279,4010672264,895050893,2319792268,494945126,1914543101,2777056443,3894764339,2219737618,311263384,4275257268,3458730721,669096869,3584475730,3835122877,3319158237,3949359204,2005142349,2713102337,2228954793,3769984788,569394103,3855636576,1425027204,108000370,2736431443,3671869269,3043122623,1750473702,2211081108,762237499,3972989403,2798899386,3061857628,2943854345,867476300,964413654,1591880597,1594774276,2179821409,552026980,3026064248,3726140315,2283577634,3110545105,2152310760,582474363,1582640421,1383256631,2043843868,3322775884,1217180674,463797851,2763038571,480777679,2718707717,2289164131,3118346187,214354409,200212307,3810608407,3025414197,2674075964,3997296425,1847405948,1342460550,510035443,4080271814,815934613,833030224,1620250387,1945732119,2703661145,3966000196,1388869545,3456054182,2687178561,2092620194,562037615,1356438536,3409922145,3261847397,1688467115,2150901366,631725691,3840332284,549916902,3455104640,394546491,837744717,2114462948,751520235,2221554606,2415360136,3999097078,2063029875,803036379,2702586305,821456707,3019566164,360699898,4018502092,3511869016,3677355358,2402471449,812317050,49299192,2570164949,3259169295,2816732080,3331213574,3101303564,2156015656,3705598920,3546263921,143268808,3200304480,1638124008,3165189453,3341807610,578956953,2193977524,3638120073,2333881532,807278310,658237817,2969561766,1641658566,11683945,3086995007,148645947,1138423386,4158756760,1981396783,2401016740,3699783584,380097457,2680394679,2803068651,3334260286,441530178,4016580796,1375954390,761952171,891809099,2183123478,157052462,3683840763,1592404427,341349109,2438483839,1417898363,644327628,2233032776,2353769706,2201510100,220455161,1815641738,182899273,2995019788,3627381533,3702638151,2890684138,1052606899,588164016,1681439879,4038439418,2405343923,4229449282,167996282,1336969661,1688053129,2739224926,1543734051,1046297529,1138201970,2121126012,115334942,1819067631,1902159161,1941945968,2206692869,1159982321],a[2]=[2381300288,637164959,3952098751,3893414151,1197506559,916448331,2350892612,2932787856,3199334847,4009478890,3905886544,1373570990,2450425862,4037870920,3778841987,2456817877,286293407,124026297,3001279700,1028597854,3115296800,4208886496,2691114635,2188540206,1430237888,1218109995,3572471700,308166588,570424558,2187009021,2455094765,307733056,1310360322,3135275007,1384269543,2388071438,863238079,2359263624,2801553128,3380786597,2831162807,1470087780,1728663345,4072488799,1090516929,532123132,2389430977,1132193179,2578464191,3051079243,1670234342,1434557849,2711078940,1241591150,3314043432,3435360113,3091448339,1812415473,2198440252,267246943,796911696,3619716990,38830015,1526438404,2806502096,374413614,2943401790,1489179520,1603809326,1920779204,168801282,260042626,2358705581,1563175598,2397674057,1356499128,2217211040,514611088,2037363785,2186468373,4022173083,2792511869,2913485016,1173701892,4200428547,3896427269,1334932762,2455136706,602925377,2835607854,1613172210,41346230,2499634548,2457437618,2188827595,41386358,4172255629,1313404830,2405527007,3801973774,2217704835,873260488,2528884354,2478092616,4012915883,2555359016,2006953883,2463913485,575479328,2218240648,2099895446,660001756,2341502190,3038761536,3888151779,3848713377,3286851934,1022894237,1620365795,3449594689,1551255054,15374395,3570825345,4249311020,4151111129,3181912732,310226346,1133119310,530038928,136043402,2476768958,3107506709,2544909567,1036173560,2367337196,1681395281,1758231547,3641649032,306774401,1575354324,3716085866,1990386196,3114533736,2455606671,1262092282,3124342505,2768229131,4210529083,1833535011,423410938,660763973,2187129978,1639812e3,3508421329,3467445492,310289298,272797111,2188552562,2456863912,310240523,677093832,1013118031,901835429,3892695601,1116285435,3036471170,1337354835,243122523,520626091,277223598,4244441197,4194248841,1766575121,594173102,316590669,742362309,3536858622,4176435350,3838792410,2501204839,1229605004,3115755532,1552908988,2312334149,979407927,3959474601,1148277331,176638793,3614686272,2083809052,40992502,1340822838,2731552767,3535757508,3560899520,1354035053,122129617,7215240,2732932949,3118912700,2718203926,2539075635,3609230695,3725561661,1928887091,2882293555,1988674909,2063640240,2491088897,1459647954,4189817080,2302804382,1113892351,2237858528,1927010603,4002880361,1856122846,1594404395,2944033133,3855189863,3474975698,1643104450,4054590833,3431086530,1730235576,2984608721,3084664418,2131803598,4178205752,267404349,1617849798,1616132681,1462223176,736725533,2327058232,551665188,2945899023,1749386277,2575514597,1611482493,674206544,2201269090,3642560800,728599968,1680547377,2620414464,1388111496,453204106,4156223445,1094905244,2754698257,2201108165,3757000246,2704524545,3922940700,3996465027],a[3]=[2645754912,532081118,2814278639,3530793624,1246723035,1689095255,2236679235,4194438865,2116582143,3859789411,157234593,2045505824,4245003587,1687664561,4083425123,605965023,672431967,1336064205,3376611392,214114848,4258466608,3232053071,489488601,605322005,3998028058,264917351,1912574028,756637694,436560991,202637054,135989450,85393697,2152923392,3896401662,2895836408,2145855233,3535335007,115294817,3147733898,1922296357,3464822751,4117858305,1037454084,2725193275,2127856640,1417604070,1148013728,1827919605,642362335,2929772533,909348033,1346338451,3547799649,297154785,1917849091,4161712827,2883604526,3968694238,1469521537,3780077382,3375584256,1763717519,136166297,4290970789,1295325189,2134727907,2798151366,1566297257,3672928234,2677174161,2672173615,965822077,2780786062,289653839,1133871874,3491843819,35685304,1068898316,418943774,672553190,642281022,2346158704,1954014401,3037126780,4079815205,2030668546,3840588673,672283427,1776201016,359975446,3750173538,555499703,2769985273,1324923,69110472,152125443,3176785106,3822147285,1340634837,798073664,1434183902,15393959,216384236,1303690150,3881221631,3711134124,3960975413,106373927,2578434224,1455997841,1801814300,1578393881,1854262133,3188178946,3258078583,2302670060,1539295533,3505142565,3078625975,2372746020,549938159,3278284284,2620926080,181285381,2865321098,3970029511,68876850,488006234,1728155692,2608167508,836007927,2435231793,919367643,3339422534,3655756360,1457871481,40520939,1380155135,797931188,234455205,2255801827,3990488299,397000196,739833055,3077865373,2871719860,4022553888,772369276,390177364,3853951029,557662966,740064294,1640166671,1699928825,3535942136,622006121,3625353122,68743880,1742502,219489963,1664179233,1577743084,1236991741,410585305,2366487942,823226535,1050371084,3426619607,3586839478,212779912,4147118561,1819446015,1911218849,530248558,3486241071,3252585495,2886188651,3410272728,2342195030,20547779,2982490058,3032363469,3631753222,312714466,1870521650,1493008054,3491686656,615382978,4103671749,2534517445,1932181,2196105170,278426614,6369430,3274544417,2913018367,697336853,2143000447,2946413531,701099306,1558357093,2805003052,3500818408,2321334417,3567135975,216290473,3591032198,23009561,1996984579,3735042806,2024298078,3739440863,569400510,2339758983,3016033873,3097871343,3639523026,3844324983,3256173865,795471839,2951117563,4101031090,4091603803,3603732598,971261452,534414648,428311343,3389027175,2844869880,694888862,1227866773,2456207019,3043454569,2614353370,3749578031,3676663836,459166190,4132644070,1794958188,51825668,2252611902,3084671440,2036672799,3436641603,1099053433,2469121526,3059204941,1323291266,2061838604,1018778475,2233344254,2553501054,334295216,3556750194,1065731521,183467730],a[4]=[2127105028,745436345,2601412319,2788391185,3093987327,500390133,1155374404,389092991,150729210,3891597772,3523549952,1935325696,716645080,946045387,2901812282,1774124410,3869435775,4039581901,3293136918,3438657920,948246080,363898952,3867875531,1286266623,1598556673,68334250,630723836,1104211938,1312863373,613332731,2377784574,1101634306,441780740,3129959883,1917973735,2510624549,3238456535,2544211978,3308894634,1299840618,4076074851,1756332096,3977027158,297047435,3790297736,2265573040,3621810518,1311375015,1667687725,47300608,3299642885,2474112369,201668394,1468347890,576830978,3594690761,3742605952,1958042578,1747032512,3558991340,1408974056,3366841779,682131401,1033214337,1545599232,4265137049,206503691,103024618,2855227313,1337551222,2428998917,2963842932,4015366655,3852247746,2796956967,3865723491,3747938335,247794022,3755824572,702416469,2434691994,397379957,851939612,2314769512,218229120,1380406772,62274761,214451378,3170103466,2276210409,3845813286,28563499,446592073,1693330814,3453727194,29968656,3093872512,220656637,2470637031,77972100,1667708854,1358280214,4064765667,2395616961,325977563,4277240721,4220025399,3605526484,3355147721,811859167,3069544926,3962126810,652502677,3075892249,4132761541,3498924215,1217549313,3250244479,3858715919,3053989961,1538642152,2279026266,2875879137,574252750,3324769229,2651358713,1758150215,141295887,2719868960,3515574750,4093007735,4194485238,1082055363,3417560400,395511885,2966884026,179534037,3646028556,3738688086,1092926436,2496269142,257381841,3772900718,1636087230,1477059743,2499234752,3811018894,2675660129,3285975680,90732309,1684827095,1150307763,1723134115,3237045386,1769919919,1240018934,815675215,750138730,2239792499,1234303040,1995484674,138143821,675421338,1145607174,1936608440,3238603024,2345230278,2105974004,323969391,779555213,3004902369,2861610098,1017501463,2098600890,2628620304,2940611490,2682542546,1171473753,3656571411,3687208071,4091869518,393037935,159126506,1662887367,1147106178,391545844,3452332695,1891500680,3016609650,1851642611,546529401,1167818917,3194020571,2848076033,3953471836,575554290,475796850,4134673196,450035699,2351251534,844027695,1080539133,86184846,1554234488,3692025454,1972511363,2018339607,1491841390,1141460869,1061690759,4244549243,2008416118,2351104703,2868147542,1598468138,722020353,1027143159,212344630,1387219594,1725294528,3745187956,2500153616,458938280,4129215917,1828119673,544571780,3503225445,2297937496,1241802790,267843827,2694610800,1397140384,1558801448,3782667683,1806446719,929573330,2234912681,400817706,616011623,4121520928,3603768725,1761550015,1968522284,4053731006,4192232858,4005120285,872482584,3140537016,3894607381,2287405443,1963876937,3663887957,1584857e3,2975024454,1833426440,4025083860],a[5]=[4143615901,749497569,1285769319,3795025788,2514159847,23610292,3974978748,844452780,3214870880,3751928557,2213566365,1676510905,448177848,3730751033,4086298418,2307502392,871450977,3222878141,4110862042,3831651966,2735270553,1310974780,2043402188,1218528103,2736035353,4274605013,2702448458,3936360550,2693061421,162023535,2827510090,687910808,23484817,3784910947,3371371616,779677500,3503626546,3473927188,4157212626,3500679282,4248902014,2466621104,3899384794,1958663117,925738300,1283408968,3669349440,1840910019,137959847,2679828185,1239142320,1315376211,1547541505,1690155329,739140458,3128809933,3933172616,3876308834,905091803,1548541325,4040461708,3095483362,144808038,451078856,676114313,2861728291,2469707347,993665471,373509091,2599041286,4025009006,4170239449,2149739950,3275793571,3749616649,2794760199,1534877388,572371878,2590613551,1753320020,3467782511,1405125690,4270405205,633333386,3026356924,3475123903,632057672,2846462855,1404951397,3882875879,3915906424,195638627,2385783745,3902872553,1233155085,3355999740,2380578713,2702246304,2144565621,3663341248,3894384975,2502479241,4248018925,3094885567,1594115437,572884632,3385116731,767645374,1331858858,1475698373,3793881790,3532746431,1321687957,619889600,1121017241,3440213920,2070816767,2833025776,1933951238,4095615791,890643334,3874130214,859025556,360630002,925594799,1764062180,3920222280,4078305929,979562269,2810700344,4087740022,1949714515,546639971,1165388173,3069891591,1495988560,922170659,1291546247,2107952832,1813327274,3406010024,3306028637,4241950635,153207855,2313154747,1608695416,1150242611,1967526857,721801357,1220138373,3691287617,3356069787,2112743302,3281662835,1111556101,1778980689,250857638,2298507990,673216130,2846488510,3207751581,3562756981,3008625920,3417367384,2198807050,529510932,3547516680,3426503187,2364944742,102533054,2294910856,1617093527,1204784762,3066581635,1019391227,1069574518,1317995090,1691889997,3661132003,510022745,3238594800,1362108837,1817929911,2184153760,805817662,1953603311,3699844737,120799444,2118332377,207536705,2282301548,4120041617,145305846,2508124933,3086745533,3261524335,1877257368,2977164480,3160454186,2503252186,4221677074,759945014,254147243,2767453419,3801518371,629083197,2471014217,907280572,3900796746,940896768,2751021123,2625262786,3161476951,3661752313,3260732218,1425318020,2977912069,1496677566,3988592072,2140652971,3126511541,3069632175,977771578,1392695845,1698528874,1411812681,1369733098,1343739227,3620887944,1142123638,67414216,3102056737,3088749194,1626167401,2546293654,3941374235,697522451,33404913,143560186,2595682037,994885535,1247667115,3859094837,2699155541,3547024625,4114935275,2968073508,3199963069,2732024527,1237921620,951448369,1898488916,1211705605,2790989240,2233243581,3598044975],a[6]=[2246066201,858518887,1714274303,3485882003,713916271,2879113490,3730835617,539548191,36158695,1298409750,419087104,1358007170,749914897,2989680476,1261868530,2995193822,2690628854,3443622377,3780124940,3796824509,2976433025,4259637129,1551479e3,512490819,1296650241,951993153,2436689437,2460458047,144139966,3136204276,310820559,3068840729,643875328,1969602020,1680088954,2185813161,3283332454,672358534,198762408,896343282,276269502,3014846926,84060815,197145886,376173866,3943890818,3813173521,3545068822,1316698879,1598252827,2633424951,1233235075,859989710,2358460855,3503838400,3409603720,1203513385,1193654839,2792018475,2060853022,207403770,1144516871,3068631394,1121114134,177607304,3785736302,326409831,1929119770,2983279095,4183308101,3474579288,3200513878,3228482096,119610148,1170376745,3378393471,3163473169,951863017,3337026068,3135789130,2907618374,1183797387,2015970143,4045674555,2182986399,2952138740,3928772205,384012900,2454997643,10178499,2879818989,2596892536,111523738,2995089006,451689641,3196290696,235406569,1441906262,3890558523,3013735005,4158569349,1644036924,376726067,1006849064,3664579700,2041234796,1021632941,1374734338,2566452058,371631263,4007144233,490221539,206551450,3140638584,1053219195,1853335209,3412429660,3562156231,735133835,1623211703,3104214392,2738312436,4096837757,3366392578,3110964274,3956598718,3196820781,2038037254,3877786376,2339753847,300912036,3766732888,2372630639,1516443558,4200396704,1574567987,4069441456,4122592016,2699739776,146372218,2748961456,2043888151,35287437,2596680554,655490400,1132482787,110692520,1031794116,2188192751,1324057718,1217253157,919197030,686247489,3261139658,1028237775,3135486431,3059715558,2460921700,986174950,2661811465,4062904701,2752986992,3709736643,367056889,1353824391,731860949,1650113154,1778481506,784341916,357075625,3608602432,1074092588,2480052770,3811426202,92751289,877911070,3600361838,1231880047,480201094,3756190983,3094495953,434011822,87971354,363687820,1717726236,1901380172,3926403882,2481662265,400339184,1490350766,2661455099,1389319756,2558787174,784598401,1983468483,30828846,3550527752,2716276238,3841122214,1765724805,1955612312,1277890269,1333098070,1564029816,2704417615,1026694237,3287671188,1260819201,3349086767,1016692350,1582273796,1073413053,1995943182,694588404,1025494639,3323872702,3551898420,4146854327,453260480,1316140391,1435673405,3038941953,3486689407,1622062951,403978347,817677117,950059133,4246079218,3278066075,1486738320,1417279718,481875527,2549965225,3933690356,760697757,1452955855,3897451437,1177426808,1702951038,4085348628,2447005172,1084371187,3516436277,3068336338,1073369276,1027665953,3284188590,1230553676,1368340146,2226246512,267243139,2274220762,4070734279,2497715176,2423353163,2504755875],a[7]=[3793104909,3151888380,2817252029,895778965,2005530807,3871412763,237245952,86829237,296341424,3851759377,3974600970,2475086196,709006108,1994621201,2972577594,937287164,3734691505,168608556,3189338153,2225080640,3139713551,3033610191,3025041904,77524477,185966941,1208824168,2344345178,1721625922,3354191921,1066374631,1927223579,1971335949,2483503697,1551748602,2881383779,2856329572,3003241482,48746954,1398218158,2050065058,313056748,4255789917,393167848,1912293076,940740642,3465845460,3091687853,2522601570,2197016661,1727764327,364383054,492521376,1291706479,3264136376,1474851438,1685747964,2575719748,1619776915,1814040067,970743798,1561002147,2925768690,2123093554,1880132620,3151188041,697884420,2550985770,2607674513,2659114323,110200136,1489731079,997519150,1378877361,3527870668,478029773,2766872923,1022481122,431258168,1112503832,897933369,2635587303,669726182,3383752315,918222264,163866573,3246985393,3776823163,114105080,1903216136,761148244,3571337562,1690750982,3166750252,1037045171,1888456500,2010454850,642736655,616092351,365016990,1185228132,4174898510,1043824992,2023083429,2241598885,3863320456,3279669087,3674716684,108438443,2132974366,830746235,606445527,4173263986,2204105912,1844756978,2532684181,4245352700,2969441100,3796921661,1335562986,4061524517,2720232303,2679424040,634407289,885462008,3294724487,3933892248,2094100220,339117932,4048830727,3202280980,1458155303,2689246273,1022871705,2464987878,3714515309,353796843,2822958815,4256850100,4052777845,551748367,618185374,3778635579,4020649912,1904685140,3069366075,2670879810,3407193292,2954511620,4058283405,2219449317,3135758300,1120655984,3447565834,1474845562,3577699062,550456716,3466908712,2043752612,881257467,869518812,2005220179,938474677,3305539448,3850417126,1315485940,3318264702,226533026,965733244,321539988,1136104718,804158748,573969341,3708209826,937399083,3290727049,2901666755,1461057207,4013193437,4066861423,3242773476,2421326174,1581322155,3028952165,786071460,3900391652,3918438532,1485433313,4023619836,3708277595,3678951060,953673138,1467089153,1930354364,1533292819,2492563023,1346121658,1685000834,1965281866,3765933717,4190206607,2052792609,3515332758,690371149,3125873887,2180283551,2903598061,3933952357,436236910,289419410,14314871,1242357089,2904507907,1616633776,2666382180,585885352,3471299210,2699507360,1432659641,277164553,3354103607,770115018,2303809295,3741942315,3177781868,2853364978,2269453327,3774259834,987383833,1290892879,225909803,1741533526,890078084,1496906255,1111072499,916028167,243534141,1252605537,2204162171,531204876,290011180,3916834213,102027703,237315147,209093447,1486785922,220223953,2758195998,4175039106,82940208,3127791296,2569425252,518464269,1353887104,3941492737,2377294467,3935040926]}function i(e){this.cast5=new n,this.cast5.setKey(e),this.encrypt=function(e){return this.cast5.encrypt(e)}}Object.defineProperty(r,"__esModule",{value:!0}),i.blockSize=i.prototype.blockSize=8,i.keySize=i.prototype.keySize=16,r.default=i},{}],87:[function(e,t,r){"use strict";function n(e,t,r,n,i,a){const s=[16843776,0,65536,16843780,16842756,66564,4,65536,1024,16843776,16843780,1024,16778244,16842756,16777216,4,1028,16778240,16778240,66560,66560,16842752,16842752,16778244,65540,16777220,16777220,65540,0,1028,66564,16777216,65536,16843780,4,16842752,16843776,16777216,16777216,1024,16842756,65536,66560,16777220,1024,4,16778244,66564,16843780,65540,16842752,16778244,16777220,1028,66564,16843776,1028,16778240,16778240,0,65540,66560,0,16842756],o=[-2146402272,-2147450880,32768,1081376,1048576,32,-2146435040,-2147450848,-2147483616,-2146402272,-2146402304,-2147483648,-2147450880,1048576,32,-2146435040,1081344,1048608,-2147450848,0,-2147483648,32768,1081376,-2146435072,1048608,-2147483616,0,1081344,32800,-2146402304,-2146435072,32800,0,1081376,-2146435040,1048576,-2147450848,-2146435072,-2146402304,32768,-2146435072,-2147450880,32,-2146402272,1081376,32,32768,-2147483648,32800,-2146402304,1048576,-2147483616,1048608,-2147450848,-2147483616,1048608,1081344,0,-2147450880,32800,-2147483648,-2146435040,-2146402272,1081344],u=[520,134349312,0,134348808,134218240,0,131592,134218240,131080,134217736,134217736,131072,134349320,131080,134348800,520,134217728,8,134349312,512,131584,134348800,134348808,131592,134218248,131584,131072,134218248,8,134349320,512,134217728,134349312,134217728,131080,520,131072,134349312,134218240,0,512,131080,134349320,134218240,134217736,512,0,134348808,134218248,131072,134217728,134349320,8,131592,131584,134217736,134348800,134218248,520,134348800,131592,8,134348808,131584],c=[8396801,8321,8321,128,8396928,8388737,8388609,8193,0,8396800,8396800,8396929,129,0,8388736,8388609,1,8192,8388608,8396801,128,8388608,8193,8320,8388737,1,8320,8388736,8192,8396928,8396929,129,8388736,8388609,8396800,8396929,129,0,0,8396800,8320,8388736,8388737,1,8396801,8321,8321,128,8396929,129,1,8192,8388609,8193,8396928,8388737,8193,8320,8388608,8396801,128,8388608,8192,8396928],f=[256,34078976,34078720,1107296512,524288,256,1073741824,34078720,1074266368,524288,33554688,1074266368,1107296512,1107820544,524544,1073741824,33554432,1074266112,1074266112,0,1073742080,1107820800,1107820800,33554688,1107820544,1073742080,0,1107296256,34078976,33554432,1107296256,524544,524288,1107296512,256,33554432,1073741824,34078720,1107296512,1074266368,33554688,1073741824,1107820544,34078976,1074266368,256,33554432,1107820544,1107820800,524544,1107296256,1107820800,34078720,0,1074266112,1107296256,524544,33554688,1073742080,524288,0,1074266112,34078976,1073742080],d=[536870928,541065216,16384,541081616,541065216,16,541081616,4194304,536887296,4210704,4194304,536870928,4194320,536887296,536870912,16400,0,4194320,536887312,16384,4210688,536887312,16,541065232,541065232,0,4210704,541081600,16400,4210688,541081600,536870912,536887296,16,541065232,4210688,541081616,4194304,16400,536870928,4194304,536887296,536870912,16400,536870928,541081616,4210688,541065216,4210704,541081600,0,541065232,16,16384,541065216,4210704,16384,4194320,536887312,0,541081600,536870912,4194320,536887312],l=[2097152,69206018,67110914,0,2048,67110914,2099202,69208064,69208066,2097152,0,67108866,2,67108864,69206018,2050,67110912,2099202,2097154,67110912,67108866,69206016,69208064,2097154,69206016,2048,2050,69208066,2099200,2,67108864,2099200,67108864,2099200,2097152,67110914,67110914,69206018,69206018,2,2097154,67108864,67110912,2097152,69208064,2050,2099202,69208064,2050,67108866,69208066,69206016,2099200,0,2,69208066,0,2099202,69206016,2048,67108866,67110912,2048,2097154],h=[268439616,4096,262144,268701760,268435456,268439616,64,268435456,262208,268697600,268701760,266240,268701696,266304,4096,64,268697600,268435520,268439552,4160,266240,262208,268697664,268701696,4160,0,0,268697664,268435520,268439552,266304,262144,266304,262144,268701696,4096,64,268697664,4096,266304,268439552,64,268435520,268697600,268697664,268435456,262144,268439616,0,268701760,262208,268435520,268697600,268439552,268439616,0,268701760,266240,266240,4160,4160,262208,268435456,268701696];let p,y,b,m,g,w,_,v,k,A,S,E,P,x,M=0,C=t.length;const j=32===e.length?3:9;v=3===j?r?[0,32,2]:[30,-2,-2]:r?[0,32,2,62,30,-2,64,96,2]:[94,62,-2,32,64,2,30,-2,-2],r&&(C=(t=function(e,t){const r=8-e.length%8;let n;if(2===t&&r<8)n=" ".charCodeAt(0);else if(1===t)n=r;else{if(t||!(r<8)){if(8===r)return e;throw new Error("des: invalid padding")}n=0}const i=new Uint8Array(e.length+r);for(let a=0;a<e.length;a++)i[a]=e[a];for(let a=0;a<r;a++)i[e.length+a]=n;return i}(t,a)).length);let R=new Uint8Array(C),B=0;for(1===n&&(k=i[M++]<<24|i[M++]<<16|i[M++]<<8|i[M++],S=i[M++]<<24|i[M++]<<16|i[M++]<<8|i[M++],M=0);M<C;){for(w=t[M++]<<24|t[M++]<<16|t[M++]<<8|t[M++],_=t[M++]<<24|t[M++]<<16|t[M++]<<8|t[M++],1===n&&(r?(w^=k,_^=S):(A=k,E=S,k=w,S=_)),w^=(b=252645135&(w>>>4^_))<<4,w^=(b=65535&(w>>>16^(_^=b)))<<16,w^=b=858993459&((_^=b)>>>2^w),w^=b=16711935&((_^=b<<2)>>>8^w),w=(w^=(b=1431655765&(w>>>1^(_^=b<<8)))<<1)<<1|w>>>31,_=(_^=b)<<1|_>>>31,y=0;y<j;y+=3){for(P=v[y+1],x=v[y+2],p=v[y];p!==P;p+=x)m=_^e[p],g=(_>>>4|_<<28)^e[p+1],b=w,w=_,_=b^(o[m>>>24&63]|c[m>>>16&63]|d[m>>>8&63]|h[63&m]|s[g>>>24&63]|u[g>>>16&63]|f[g>>>8&63]|l[63&g]);b=w,w=_,_=b}_=_>>>1|_<<31,_^=b=1431655765&((w=w>>>1|w<<31)>>>1^_),_^=(b=16711935&(_>>>8^(w^=b<<1)))<<8,_^=(b=858993459&(_>>>2^(w^=b)))<<2,_^=b=65535&((w^=b)>>>16^_),_^=b=252645135&((w^=b<<16)>>>4^_),w^=b<<4,1===n&&(r?(k=w,S=_):(w^=A,_^=E)),R[B++]=w>>>24,R[B++]=w>>>16&255,R[B++]=w>>>8&255,R[B++]=255&w,R[B++]=_>>>24,R[B++]=_>>>16&255,R[B++]=_>>>8&255,R[B++]=255&_}return r||(R=function(e,t){let r,n=null;if(2===t)r=" ".charCodeAt(0);else if(1===t)n=e[e.length-1];else{if(t)throw new Error("des: invalid padding");r=0}if(!n){for(n=1;e[e.length-n]===r;)n++;n--}return e.subarray(0,e.length-n)}(R,a)),R}function i(e){const t=[0,4,536870912,536870916,65536,65540,536936448,536936452,512,516,536871424,536871428,66048,66052,536936960,536936964],r=[0,1,1048576,1048577,67108864,67108865,68157440,68157441,256,257,1048832,1048833,67109120,67109121,68157696,68157697],n=[0,8,2048,2056,16777216,16777224,16779264,16779272,0,8,2048,2056,16777216,16777224,16779264,16779272],i=[0,2097152,134217728,136314880,8192,2105344,134225920,136323072,131072,2228224,134348800,136445952,139264,2236416,134356992,136454144],a=[0,262144,16,262160,0,262144,16,262160,4096,266240,4112,266256,4096,266240,4112,266256],s=[0,1024,32,1056,0,1024,32,1056,33554432,33555456,33554464,33555488,33554432,33555456,33554464,33555488],o=[0,268435456,524288,268959744,2,268435458,524290,268959746,0,268435456,524288,268959744,2,268435458,524290,268959746],u=[0,65536,2048,67584,536870912,536936448,536872960,536938496,131072,196608,133120,198656,537001984,537067520,537004032,537069568],c=[0,262144,0,262144,2,262146,2,262146,33554432,33816576,33554432,33816576,33554434,33816578,33554434,33816578],f=[0,268435456,8,268435464,0,268435456,8,268435464,1024,268436480,1032,268436488,1024,268436480,1032,268436488],d=[0,32,0,32,1048576,1048608,1048576,1048608,8192,8224,8192,8224,1056768,1056800,1056768,1056800],l=[0,16777216,512,16777728,2097152,18874368,2097664,18874880,67108864,83886080,67109376,83886592,69206016,85983232,69206528,85983744],h=[0,4096,134217728,134221824,524288,528384,134742016,134746112,16,4112,134217744,134221840,524304,528400,134742032,134746128],p=[0,4,256,260,0,4,256,260,1,5,257,261,1,5,257,261],y=e.length>8?3:1,b=new Array(32*y),m=[0,0,1,1,1,1,1,1,0,1,1,1,1,1,1,0];let g,w,_,v=0,k=0;for(let A=0;A<y;A++){let y=e[v++]<<24|e[v++]<<16|e[v++]<<8|e[v++],A=e[v++]<<24|e[v++]<<16|e[v++]<<8|e[v++];y^=(_=252645135&(y>>>4^A))<<4,y^=_=65535&((A^=_)>>>-16^y),y^=(_=858993459&(y>>>2^(A^=_<<-16)))<<2,y^=_=65535&((A^=_)>>>-16^y),y^=(_=1431655765&(y>>>1^(A^=_<<-16)))<<1,y^=_=16711935&((A^=_)>>>8^y),_=(y^=(_=1431655765&(y>>>1^(A^=_<<8)))<<1)<<8|(A^=_)>>>20&240,y=A<<24|A<<8&16711680|A>>>8&65280|A>>>24&240,A=_;for(let e=0;e<m.length;e++)m[e]?(y=y<<2|y>>>26,A=A<<2|A>>>26):(y=y<<1|y>>>27,A=A<<1|A>>>27),_=65535&((w=u[(A&=-15)>>>28]|c[A>>>24&15]|f[A>>>20&15]|d[A>>>16&15]|l[A>>>12&15]|h[A>>>8&15]|p[A>>>4&15])>>>16^(g=t[(y&=-15)>>>28]|r[y>>>24&15]|n[y>>>20&15]|i[y>>>16&15]|a[y>>>12&15]|s[y>>>8&15]|o[y>>>4&15])),b[k++]=g^_,b[k++]=w^_<<16}return b}function a(e){this.key=[];for(let t=0;t<3;t++)this.key.push(new Uint8Array(e.subarray(8*t,8*t+8)));this.encrypt=function(e){return n(i(this.key[2]),n(i(this.key[1]),n(i(this.key[0]),e,!0,0,null,null),!1,0,null,null),!0,0,null,null)}}Object.defineProperty(r,"__esModule",{value:!0}),a.keySize=a.prototype.keySize=24,a.blockSize=a.prototype.blockSize=8,r.default={DES:function(e){this.key=e,this.encrypt=function(e,t){return n(i(this.key),e,!0,0,null,t)},this.decrypt=function(e,t){return n(i(this.key),e,!1,0,null,t)}},TripleDES:a}},{}],88:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("./aes")),i=u(e("./des.js")),a=u(e("./cast5")),s=u(e("./twofish")),o=u(e("./blowfish"));function u(e){return e&&e.__esModule?e:{default:e}}r.default={aes128:(0,n.default)(128),aes192:(0,n.default)(192),aes256:(0,n.default)(256),des:i.default.DES,tripledes:i.default.TripleDES,"3des":i.default.TripleDES,cast5:a.default,twofish:s.default,blowfish:o.default,idea:function(){throw new Error("IDEA symmetric-key algorithm not implemented")}}},{"./aes":84,"./blowfish":85,"./cast5":86,"./des.js":87,"./twofish":89}],89:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});const n=4294967295;function i(e,t){return(e<<t|e>>>32-t)&n}function a(e,t){return e[t]|e[t+1]<<8|e[t+2]<<16|e[t+3]<<24}function s(e,t,r){e.splice(t,4,255&r,r>>>8&255,r>>>16&255,r>>>24&255)}function o(e,t){return e>>>8*t&255}function u(e){this.tf=function(){let e=null,t=null,r=-1,u=[],c=[[],[],[],[]];function f(e){return c[0][o(e,0)]^c[1][o(e,1)]^c[2][o(e,2)]^c[3][o(e,3)]}function d(e){return c[0][o(e,3)]^c[1][o(e,0)]^c[2][o(e,1)]^c[3][o(e,2)]}function l(e,t){let r=f(t[0]),a=d(t[1]);t[2]=i(t[2]^r+a+u[4*e+8]&n,31),t[3]=i(t[3],1)^r+2*a+u[4*e+9]&n,r=f(t[2]),a=d(t[3]),t[0]=i(t[0]^r+a+u[4*e+10]&n,31),t[1]=i(t[1],1)^r+2*a+u[4*e+11]&n}function h(e,t){let r=f(t[0]),a=d(t[1]);t[2]=i(t[2],1)^r+a+u[4*e+10]&n,t[3]=i(t[3]^r+2*a+u[4*e+11]&n,31),r=f(t[2]),a=d(t[3]),t[0]=i(t[0],1)^r+a+u[4*e+8]&n,t[1]=i(t[1]^r+2*a+u[4*e+9]&n,31)}return{name:"twofish",blocksize:16,open:function(t){let r,s,f,d,l;const h=[],p=[],y=[];let b;const m=[];let g,w,_;const v=[[8,1,7,13,6,15,3,2,0,11,5,9,14,12,10,4],[2,8,11,13,15,7,6,14,3,1,9,4,0,10,12,5]],k=[[14,12,11,8,1,2,3,5,15,4,10,6,7,0,9,13],[1,14,2,11,4,12,3,7,6,13,10,5,15,9,0,8]],A=[[11,10,5,14,6,13,9,0,12,8,15,3,2,4,7,1],[4,12,7,5,1,6,9,10,0,14,13,8,2,11,3,15]],S=[[13,7,15,4,1,2,6,14,9,11,3,0,8,5,12,10],[11,9,5,1,12,3,13,14,6,4,7,15,2,0,8,10]],E=[0,8,1,9,2,10,3,11,4,12,5,13,6,14,7,15],P=[0,9,2,11,4,13,6,15,8,1,10,3,12,5,14,7],x=[[],[]],M=[[],[],[],[]];function C(e){return e^e>>2^[0,90,180,238][3&e]}function j(e){return e^e>>1^e>>2^[0,238,180,90][3&e]}function R(e,t){let r,i,a;for(r=0;r<8;r++)i=t>>>24,t=t<<8&n|e>>>24,e=e<<8&n,a=i<<1,128&i&&(a^=333),t^=i^a<<16,a^=i>>>1,1&i&&(a^=166),t^=a<<24|a<<8;return t}function B(e,t){const r=t>>4,n=15&t,i=v[e][r^n],a=k[e][E[n]^P[r]];return S[e][E[a]^P[i]]<<4|A[e][i^a]}function K(e,t){let r=o(e,0),n=o(e,1),i=o(e,2),a=o(e,3);switch(b){case 4:r=x[1][r]^o(t[3],0),n=x[0][n]^o(t[3],1),i=x[0][i]^o(t[3],2),a=x[1][a]^o(t[3],3);case 3:r=x[1][r]^o(t[2],0),n=x[1][n]^o(t[2],1),i=x[0][i]^o(t[2],2),a=x[0][a]^o(t[2],3);case 2:r=x[0][x[0][r]^o(t[1],0)]^o(t[0],0),n=x[0][x[1][n]^o(t[1],1)]^o(t[0],1),i=x[1][x[0][i]^o(t[1],2)]^o(t[0],2),a=x[1][x[1][a]^o(t[1],3)]^o(t[0],3)}return M[0][r]^M[1][n]^M[2][i]^M[3][a]}for(r=(e=(e=t).slice(0,32)).length;16!==r&&24!==r&&32!==r;)e[r++]=0;for(r=0;r<e.length;r+=4)y[r>>2]=a(e,r);for(r=0;r<256;r++)x[0][r]=B(0,r),x[1][r]=B(1,r);for(r=0;r<256;r++)w=C(g=x[1][r]),_=j(g),M[0][r]=g+(w<<8)+(_<<16)+(_<<24),M[2][r]=w+(_<<8)+(g<<16)+(_<<24),w=C(g=x[0][r]),_=j(g),M[1][r]=_+(_<<8)+(w<<16)+(g<<24),M[3][r]=w+(g<<8)+(_<<16)+(w<<24);for(b=y.length/2,r=0;r<b;r++)s=y[r+r],h[r]=s,f=y[r+r+1],p[r]=f,m[b-r-1]=R(s,f);for(r=0;r<40;r+=2)f=16843009+(s=16843009*r),s=K(s,h),f=i(K(f,p),8),u[r]=s+f&n,u[r+1]=i(s+2*f,9);for(r=0;r<256;r++)switch(s=f=d=l=r,b){case 4:s=x[1][s]^o(m[3],0),f=x[0][f]^o(m[3],1),d=x[0][d]^o(m[3],2),l=x[1][l]^o(m[3],3);case 3:s=x[1][s]^o(m[2],0),f=x[1][f]^o(m[2],1),d=x[0][d]^o(m[2],2),l=x[0][l]^o(m[2],3);case 2:c[0][r]=M[0][x[0][x[0][s]^o(m[1],0)]^o(m[0],0)],c[1][r]=M[1][x[0][x[1][f]^o(m[1],1)]^o(m[0],1)],c[2][r]=M[2][x[1][x[0][d]^o(m[1],2)]^o(m[0],2)],c[3][r]=M[3][x[1][x[1][l]^o(m[1],3)]^o(m[0],3)]}},close:function(){u=[],c=[[],[],[],[]]},encrypt:function(e,n){const i=[a(t=e,r=n)^u[0],a(t,r+4)^u[1],a(t,r+8)^u[2],a(t,r+12)^u[3]];for(let t=0;t<8;t++)l(t,i);return s(t,r,i[2]^u[4]),s(t,r+4,i[3]^u[5]),s(t,r+8,i[0]^u[6]),s(t,r+12,i[1]^u[7]),r+=16,t},decrypt:function(e,n){const i=[a(t=e,r=n)^u[4],a(t,r+4)^u[5],a(t,r+8)^u[6],a(t,r+12)^u[7]];for(let t=7;t>=0;t--)h(t,i);s(t,r,i[2]^u[0]),s(t,r+4,i[3]^u[1]),s(t,r+8,i[0]^u[2]),s(t,r+12,i[1]^u[3]),r+=16},finalize:function(){return t}}}(),this.tf.open(Array.from(e),0),this.encrypt=function(e){return this.tf.encrypt(Array.from(e),0)}}u.keySize=u.prototype.keySize=32,u.blockSize=u.prototype.blockSize=16,r.default=u},{}],90:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("asmcrypto.js/dist_es5/aes/cbc"),a=e("../util"),s=(n=a)&&n.__esModule?n:{default:n};const o=s.default.getWebCrypto(),u=s.default.getNodeCrypto(),c=s.default.getNodeBuffer(),f=16;function d(e,t){const r=e.length-f;for(let n=0;n<f;n++)e[n+r]^=t[n];return e}const l=new Uint8Array(f);r.default=async function(e){const t=await async function(e){if(s.default.getWebCrypto()&&24!==e.length)return e=await o.importKey("raw",e,{name:"AES-CBC",length:8*e.length},!1,["encrypt"]),async function(t){const r=await o.encrypt({name:"AES-CBC",iv:l,length:8*f},e,t);return new Uint8Array(r).subarray(0,r.byteLength-f)};if(s.default.getNodeCrypto())return e=new c(e),async function(t){t=new c(t);const r=new u.createCipheriv("aes-"+8*e.length+"-cbc",e,l),n=r.update(t);return new Uint8Array(n)};return async function(t){return i.AES_CBC.encrypt(t,e,!1,l)}}(e),r=s.default.double(await t(l)),n=s.default.double(r);return async function(e){return(await t(function(e,t,r){if(e.length&&e.length%f==0)return d(e,t);const n=new Uint8Array(e.length+(f-e.length%f));return n.set(e),n[e.length]=128,d(n,r)}(e,r,n))).subarray(-f)}}},{"../util":154,"asmcrypto.js/dist_es5/aes/cbc":5}],91:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=h(e("bn.js")),i=h(e("./public_key")),a=h(e("./cipher")),s=h(e("./random")),o=h(e("../type/ecdh_symkey")),u=h(e("../type/kdf_params")),c=h(e("../type/mpi")),f=h(e("../type/oid")),d=h(e("../enums")),l=h(e("../util"));function h(e){return e&&e.__esModule?e:{default:e}}function p(e,t){return e.map(function(e,r){return t&&t[r]?new e(t[r]):new e})}r.default={publicKeyEncrypt:async function(e,t,r,a){const s=this.getEncSessionKeyParamTypes(e);return async function(){switch(e){case d.default.publicKey.rsa_encrypt:case d.default.publicKey.rsa_encrypt_sign:{const e=r.toBN(),n=t[0].toBN(),a=t[1].toBN(),o=await i.default.rsa.encrypt(e,n,a);return p(s,[o])}case d.default.publicKey.elgamal:{const e=r.toBN(),n=t[0].toBN(),a=t[1].toBN(),o=t[2].toBN(),u=await i.default.elgamal.encrypt(e,n,a,o);return p(s,[u.c1,u.c2])}case d.default.publicKey.ecdh:{const e=t[0],u=t[1].toUint8Array(),c=t[2];var o=await i.default.elliptic.ecdh.encrypt(e,c.cipher,c.hash,r,u,a);const f=o.V,d=o.C;return p(s,[new n.default(f),d])}default:return[]}}()},publicKeyDecrypt:async function(e,t,r,n){return new c.default(await async function(){switch(e){case d.default.publicKey.rsa_encrypt_sign:case d.default.publicKey.rsa_encrypt:{const e=r[0].toBN(),n=t[0].toBN(),a=t[1].toBN(),s=t[2].toBN(),o=t[3].toBN(),u=t[4].toBN(),c=t[5].toBN();return i.default.rsa.decrypt(e,n,a,s,o,u,c)}case d.default.publicKey.elgamal:{const e=r[0].toBN(),n=r[1].toBN(),a=t[0].toBN(),s=t[3].toBN();return i.default.elgamal.decrypt(e,n,a,s)}case d.default.publicKey.ecdh:{const e=t[0],a=t[2],s=r[0].toUint8Array(),o=r[1].data,u=t[3].toUint8Array();return i.default.elliptic.ecdh.decrypt(e,a.cipher,a.hash,s,o,u,n)}default:throw new Error("Invalid public key encryption algorithm.")}}())},getPrivKeyParamTypes:function(e){switch(e){case d.default.publicKey.rsa_encrypt:case d.default.publicKey.rsa_encrypt_sign:case d.default.publicKey.rsa_sign:return[c.default,c.default,c.default,c.default];case d.default.publicKey.elgamal:case d.default.publicKey.dsa:return[c.default];case d.default.publicKey.ecdh:case d.default.publicKey.ecdsa:case d.default.publicKey.eddsa:return[c.default];default:throw new Error("Invalid public key encryption algorithm.")}},getPubKeyParamTypes:function(e){switch(e){case d.default.publicKey.rsa_encrypt:case d.default.publicKey.rsa_encrypt_sign:case d.default.publicKey.rsa_sign:return[c.default,c.default];case d.default.publicKey.elgamal:return[c.default,c.default,c.default];case d.default.publicKey.dsa:return[c.default,c.default,c.default,c.default];case d.default.publicKey.ecdsa:case d.default.publicKey.eddsa:return[f.default,c.default];case d.default.publicKey.ecdh:return[f.default,c.default,u.default];default:throw new Error("Invalid public key encryption algorithm.")}},getEncSessionKeyParamTypes:function(e){switch(e){case d.default.publicKey.rsa_encrypt:case d.default.publicKey.rsa_encrypt_sign:return[c.default];case d.default.publicKey.elgamal:return[c.default,c.default];case d.default.publicKey.ecdh:return[c.default,o.default];default:throw new Error("Invalid public key encryption algorithm.")}},generateParams:function(e,t,r){const n=[].concat(this.getPubKeyParamTypes(e),this.getPrivKeyParamTypes(e));switch(e){case d.default.publicKey.rsa_encrypt:case d.default.publicKey.rsa_encrypt_sign:case d.default.publicKey.rsa_sign:return i.default.rsa.generate(t,"10001").then(function(e){return p(n,[e.n,e.e,e.d,e.p,e.q,e.u])});case d.default.publicKey.dsa:case d.default.publicKey.elgamal:throw new Error("Unsupported algorithm for key generation.");case d.default.publicKey.ecdsa:case d.default.publicKey.eddsa:return i.default.elliptic.generate(r).then(function(e){return p(n,[e.oid,e.Q,e.d])});case d.default.publicKey.ecdh:return i.default.elliptic.generate(r).then(function(e){return p(n,[e.oid,e.Q,[e.hash,e.cipher],e.d])});default:throw new Error("Invalid public key algorithm.")}},getPrefixRandom:async function(e){const t=await s.default.getRandomBytes(a.default[e].blockSize),r=new Uint8Array([t[t.length-2],t[t.length-1]]);return l.default.concat([t,r])},generateSessionKey:function(e){return s.default.getRandomBytes(a.default[e].keySize)},constructParams:p}},{"../enums":115,"../type/ecdh_symkey":148,"../type/kdf_params":149,"../type/mpi":151,"../type/oid":152,"../util":154,"./cipher":88,"./public_key":108,"./random":111,"bn.js":17}],92:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=function(){return function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var r=[],n=!0,i=!1,a=void 0;try{for(var s,o=e[Symbol.iterator]();!(n=(s=o.next()).done)&&(r.push(s.value),!t||r.length!==t);n=!0);}catch(u){i=!0,a=u}finally{try{!n&&o.return&&o.return()}finally{if(i)throw a}}return r}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),i=e("asmcrypto.js/dist_es5/aes/ctr"),a=o(e("./cmac")),s=o(e("../util"));function o(e){return e&&e.__esModule?e:{default:e}}const u=s.default.getWebCrypto(),c=s.default.getNodeCrypto(),f=s.default.getNodeBuffer(),d=16,l=d,h=d,p=new Uint8Array(d),y=new Uint8Array(d);y[d-1]=1;const b=new Uint8Array(d);async function m(e){const t=await(0,a.default)(e);return function(e,r){return t(s.default.concatUint8Array([e,r]))}}async function g(e){return s.default.getWebCrypto()&&24!==e.length&&-1===navigator.userAgent.indexOf("Edge")?(e=await u.importKey("raw",e,{name:"AES-CTR",length:8*e.length},!1,["encrypt"]),async function(t,r){const n=await u.encrypt({name:"AES-CTR",counter:r,length:8*d},e,t);return new Uint8Array(n)}):s.default.getNodeCrypto()?(e=new f(e),async function(t,r){t=new f(t),r=new f(r);const n=new c.createCipheriv("aes-"+8*e.length+"-ctr",e,r),i=f.concat([n.update(t),n.final()]);return new Uint8Array(i)}):async function(t,r){return i.AES_CTR.encrypt(t,e,r)}}async function w(e,t){if("aes"!==e.substr(0,3))throw new Error("EAX mode supports only AES cipher");var r=await Promise.all([m(t),g(t)]),i=n(r,2);const a=i[0],o=i[1];return{encrypt:async function(e,t,r){var i=await Promise.all([a(p,t),a(y,r)]),u=n(i,2);const c=u[0],f=u[1],d=await o(e,c),l=await a(b,d);for(let n=0;n<h;n++)l[n]^=f[n]^c[n];return s.default.concatUint8Array([d,l])},decrypt:async function(e,t,r){if(e.length<h)throw new Error("Invalid EAX ciphertext");const i=e.subarray(0,-h),u=e.subarray(-h);var c=await Promise.all([a(p,t),a(y,r),a(b,i)]),f=n(c,3);const d=f[0],l=f[1],m=f[2];for(let n=0;n<h;n++)m[n]^=l[n]^d[n];if(!s.default.equalsUint8Array(u,m))throw new Error("Authentication tag mismatch");return await o(i,d)}}}b[d-1]=2,w.getNonce=function(e,t){const r=e.slice();for(let n=0;n<t.length;n++)r[8+n]^=t[n];return r},w.blockLength=d,w.ivLength=l,w.tagLength=h,r.default=w},{"../util":154,"./cmac":90,"asmcrypto.js/dist_es5/aes/ctr":7}],93:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("asmcrypto.js/dist_es5/aes/gcm"),a=e("../util"),s=(n=a)&&n.__esModule?n:{default:n};const o=s.default.getWebCrypto(),u=s.default.getNodeCrypto(),c=s.default.getNodeBuffer(),f=16,d="AES-GCM";async function l(e,t){if("aes"!==e.substr(0,3))throw new Error("GCM mode supports only AES cipher");if(s.default.getWebCrypto()&&24!==t.length){const e=await o.importKey("raw",t,{name:d},!1,["encrypt","decrypt"]);return{encrypt:async function(r,n,a=new Uint8Array){if(!r.length||!a.length&&-1!==navigator.userAgent.indexOf("Edge"))return i.AES_GCM.encrypt(r,t,n,a);const s=await o.encrypt({name:d,iv:n,additionalData:a,tagLength:8*f},e,r);return new Uint8Array(s)},decrypt:async function(r,n,a=new Uint8Array){if(r.length===f||!a.length&&-1!==navigator.userAgent.indexOf("Edge"))return i.AES_GCM.decrypt(r,t,n,a);const s=await o.decrypt({name:d,iv:n,additionalData:a,tagLength:8*f},e,r);return new Uint8Array(s)}}}return s.default.getNodeCrypto()?(t=new c(t),{encrypt:async function(e,r,n=new Uint8Array){e=new c(e),r=new c(r),n=new c(n);const i=new u.createCipheriv("aes-"+8*t.length+"-gcm",t,r);i.setAAD(n);const a=c.concat([i.update(e),i.final(),i.getAuthTag()]);return new Uint8Array(a)},decrypt:async function(e,r,n=new Uint8Array){e=new c(e),r=new c(r),n=new c(n);const i=new u.createDecipheriv("aes-"+8*t.length+"-gcm",t,r);i.setAAD(n),i.setAuthTag(e.slice(e.length-f,e.length));const a=c.concat([i.update(e.slice(0,e.length-f)),i.final()]);return new Uint8Array(a)}}):{encrypt:async function(e,r,n){return i.AES_GCM.encrypt(e,t,r,n)},decrypt:async function(e,r,n){return i.AES_GCM.decrypt(e,t,r,n)}}}l.getNonce=function(e,t){const r=e.slice();for(let n=0;n<t.length;n++)r[4+n]^=t[n];return r},l.blockLength=16,l.ivLength=12,l.tagLength=f,r.default=l},{"../util":154,"asmcrypto.js/dist_es5/aes/gcm":9}],94:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("asmcrypto.js/dist_es5/hash/sha1/sha1"),i=e("asmcrypto.js/dist_es5/hash/sha256/sha256"),a=h(e("hash.js/lib/hash/sha/224")),s=h(e("hash.js/lib/hash/sha/384")),o=h(e("hash.js/lib/hash/sha/512")),u=e("hash.js/lib/hash/ripemd"),c=h(e("web-stream-tools")),f=h(e("./md5")),d=h(e("../../config")),l=h(e("../../util"));function h(e){return e&&e.__esModule?e:{default:e}}const p=l.default.getWebCrypto(),y=l.default.getNodeCrypto(),b=l.default.getNodeBuffer();function m(e){return async function(t){const r=y.createHash(e);return c.default.transform(t,e=>{r.update(new b(e))},()=>new Uint8Array(r.digest()))}}function g(e,t){return async function(r){if(!l.default.isStream(r)&&p&&t&&r.length>=d.default.min_bytes_for_web_crypto)return new Uint8Array(await p.digest(t,r));const n=e();return c.default.transform(r,e=>{n.update(e)},()=>new Uint8Array(n.digest()))}}function w(e,t){return async function(r){if(l.default.isStream(r)){const t=new e;return c.default.transform(r,e=>{t.process(e)},()=>t.finish().result)}return p&&t&&r.length>=d.default.min_bytes_for_web_crypto?new Uint8Array(await p.digest(t,r)):e.bytes(r)}}let _;_=y?{md5:m("md5"),sha1:m("sha1"),sha224:m("sha224"),sha256:m("sha256"),sha384:m("sha384"),sha512:m("sha512"),ripemd:m("ripemd160")}:{md5:f.default,sha1:w(n.Sha1,-1===navigator.userAgent.indexOf("Edge")&&"SHA-1"),sha224:g(a.default),sha256:w(i.Sha256,"SHA-256"),sha384:g(s.default,"SHA-384"),sha512:g(o.default,"SHA-512"),ripemd:g(u.ripemd160)},r.default={md5:_.md5,sha1:_.sha1,sha224:_.sha224,sha256:_.sha256,sha384:_.sha384,sha512:_.sha512,ripemd:_.ripemd,digest:function(e,t){switch(e){case 1:return this.md5(t);case 2:return this.sha1(t);case 3:return this.ripemd(t);case 8:return this.sha256(t);case 9:return this.sha384(t);case 10:return this.sha512(t);case 11:return this.sha224(t);default:throw new Error("Invalid hash function.")}},getHashByteLength:function(e){switch(e){case 1:return 16;case 2:case 3:return 20;case 8:return 32;case 9:return 48;case 10:return 64;case 11:return 28;default:throw new Error("Invalid hash algorithm.")}}}},{"../../config":81,"../../util":154,"./md5":95,"asmcrypto.js/dist_es5/hash/sha1/sha1":12,"asmcrypto.js/dist_es5/hash/sha256/sha256":14,"hash.js/lib/hash/ripemd":39,"hash.js/lib/hash/sha/224":42,"hash.js/lib/hash/sha/384":44,"hash.js/lib/hash/sha/512":45,"web-stream-tools":77}],95:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../../util"),a=(n=i)&&n.__esModule?n:{default:n};function s(e,t){let r=e[0],n=e[1],i=e[2],a=e[3];r=u(r,n,i,a,t[0],7,-680876936),a=u(a,r,n,i,t[1],12,-389564586),i=u(i,a,r,n,t[2],17,606105819),n=u(n,i,a,r,t[3],22,-1044525330),r=u(r,n,i,a,t[4],7,-176418897),a=u(a,r,n,i,t[5],12,1200080426),i=u(i,a,r,n,t[6],17,-1473231341),n=u(n,i,a,r,t[7],22,-45705983),r=u(r,n,i,a,t[8],7,1770035416),a=u(a,r,n,i,t[9],12,-1958414417),i=u(i,a,r,n,t[10],17,-42063),n=u(n,i,a,r,t[11],22,-1990404162),r=u(r,n,i,a,t[12],7,1804603682),a=u(a,r,n,i,t[13],12,-40341101),i=u(i,a,r,n,t[14],17,-1502002290),r=c(r,n=u(n,i,a,r,t[15],22,1236535329),i,a,t[1],5,-165796510),a=c(a,r,n,i,t[6],9,-1069501632),i=c(i,a,r,n,t[11],14,643717713),n=c(n,i,a,r,t[0],20,-373897302),r=c(r,n,i,a,t[5],5,-701558691),a=c(a,r,n,i,t[10],9,38016083),i=c(i,a,r,n,t[15],14,-660478335),n=c(n,i,a,r,t[4],20,-405537848),r=c(r,n,i,a,t[9],5,568446438),a=c(a,r,n,i,t[14],9,-1019803690),i=c(i,a,r,n,t[3],14,-187363961),n=c(n,i,a,r,t[8],20,1163531501),r=c(r,n,i,a,t[13],5,-1444681467),a=c(a,r,n,i,t[2],9,-51403784),i=c(i,a,r,n,t[7],14,1735328473),r=f(r,n=c(n,i,a,r,t[12],20,-1926607734),i,a,t[5],4,-378558),a=f(a,r,n,i,t[8],11,-2022574463),i=f(i,a,r,n,t[11],16,1839030562),n=f(n,i,a,r,t[14],23,-35309556),r=f(r,n,i,a,t[1],4,-1530992060),a=f(a,r,n,i,t[4],11,1272893353),i=f(i,a,r,n,t[7],16,-155497632),n=f(n,i,a,r,t[10],23,-1094730640),r=f(r,n,i,a,t[13],4,681279174),a=f(a,r,n,i,t[0],11,-358537222),i=f(i,a,r,n,t[3],16,-722521979),n=f(n,i,a,r,t[6],23,76029189),r=f(r,n,i,a,t[9],4,-640364487),a=f(a,r,n,i,t[12],11,-421815835),i=f(i,a,r,n,t[15],16,530742520),r=d(r,n=f(n,i,a,r,t[2],23,-995338651),i,a,t[0],6,-198630844),a=d(a,r,n,i,t[7],10,1126891415),i=d(i,a,r,n,t[14],15,-1416354905),n=d(n,i,a,r,t[5],21,-57434055),r=d(r,n,i,a,t[12],6,1700485571),a=d(a,r,n,i,t[3],10,-1894986606),i=d(i,a,r,n,t[10],15,-1051523),n=d(n,i,a,r,t[1],21,-2054922799),r=d(r,n,i,a,t[8],6,1873313359),a=d(a,r,n,i,t[15],10,-30611744),i=d(i,a,r,n,t[6],15,-1560198380),n=d(n,i,a,r,t[13],21,1309151649),r=d(r,n,i,a,t[4],6,-145523070),a=d(a,r,n,i,t[11],10,-1120210379),i=d(i,a,r,n,t[2],15,718787259),n=d(n,i,a,r,t[9],21,-343485551),e[0]=y(r,e[0]),e[1]=y(n,e[1]),e[2]=y(i,e[2]),e[3]=y(a,e[3])}function o(e,t,r,n,i,a){return t=y(y(t,e),y(n,a)),y(t<<i|t>>>32-i,r)}function u(e,t,r,n,i,a,s){return o(t&r|~t&n,e,t,i,a,s)}function c(e,t,r,n,i,a,s){return o(t&n|r&~n,e,t,i,a,s)}function f(e,t,r,n,i,a,s){return o(t^r^n,e,t,i,a,s)}function d(e,t,r,n,i,a,s){return o(r^(t|~n),e,t,i,a,s)}function l(e){const t=[];let r;for(r=0;r<64;r+=4)t[r>>2]=e.charCodeAt(r)+(e.charCodeAt(r+1)<<8)+(e.charCodeAt(r+2)<<16)+(e.charCodeAt(r+3)<<24);return t}const h="0123456789abcdef".split("");function p(e){let t="",r=0;for(;r<4;r++)t+=h[e>>8*r+4&15]+h[e>>8*r&15];return t}function y(e,t){return e+t&4294967295}r.default=async function(e){const t=function(e){const t=e.length,r=[1732584193,-271733879,-1732584194,271733878];let n;for(n=64;n<=e.length;n+=64)s(r,l(e.substring(n-64,n)));e=e.substring(n-64);const i=[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0];for(n=0;n<e.length;n++)i[n>>2]|=e.charCodeAt(n)<<(n%4<<3);if(i[n>>2]|=128<<(n%4<<3),n>55)for(s(r,i),n=0;n<16;n++)i[n]=0;return i[14]=8*t,s(r,i),r}(a.default.Uint8Array_to_str(e));return a.default.hex_to_Uint8Array(function(e){for(let t=0;t<e.length;t++)e[t]=p(e[t]);return e.join("")}(t))}},{"../../util":154}],96:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=b(e("./cipher")),i=b(e("./hash")),a=b(e("./cfb")),s=b(e("./gcm")),o=b(e("./eax")),u=b(e("./ocb")),c=b(e("./public_key")),f=b(e("./signature")),d=b(e("./random")),l=b(e("./pkcs1")),h=b(e("./pkcs5")),p=b(e("./crypto")),y=b(e("./aes_kw"));function b(e){return e&&e.__esModule?e:{default:e}}const m={cipher:n.default,hash:i.default,cfb:a.default,gcm:s.default,experimental_gcm:s.default,eax:o.default,ocb:u.default,publicKey:c.default,signature:f.default,random:d.default,pkcs1:l.default,pkcs5:h.default,aes_kw:y.default};Object.assign(m,p.default),r.default=m},{"./aes_kw":82,"./cfb":83,"./cipher":88,"./crypto":91,"./eax":92,"./gcm":93,"./hash":94,"./ocb":97,"./pkcs1":98,"./pkcs5":99,"./public_key":108,"./random":111,"./signature":112}],97:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("./cipher")),i=a(e("../util"));function a(e){return e&&e.__esModule?e:{default:e}}const s=16,o=15,u=16;function c(e){let t=0;for(let r=1;0==(e&r);r<<=1)t++;return t}function f(e,t){for(let r=0;r<e.length;r++)e[r]^=t[r];return e}function d(e,t){return f(e.slice(),t)}const l=new Uint8Array(s),h=new Uint8Array([1]);async function p(e,t){let r,a,p,y=0;function b(e,t,n,a){const b=t.length/s|0;!function(e,t){const r=i.default.nbits(Math.max(e.length,t.length)/s|0)-1;for(let n=y+1;n<=r;n++)p[n]=i.default.double(p[n-1]);y=r}(t,a);const m=i.default.concatUint8Array([l.subarray(0,o-n.length),h,n]),g=63&m[s-1];m[s-1]&=192;const w=r(m),_=i.default.concatUint8Array([w,d(w.subarray(0,8),w.subarray(1,9))]),v=i.default.shiftRight(_.subarray(0+(g>>3),17+(g>>3)),8-(7&g)).subarray(1),k=new Uint8Array(s),A=new Uint8Array(t.length+u);let S,E=0;for(S=0;S<b;S++)f(v,p[c(S+1)]),A.set(f(e(d(v,t)),v),E),f(k,e===r?t:A.subarray(E)),t=t.subarray(s),E+=s;if(t.length){f(v,p.x);const n=r(v);A.set(d(t,n),E);const i=new Uint8Array(s);i.set(e===r?t:A.subarray(E,-u),0),i[t.length]=128,f(k,i),E+=t.length}const P=f(r(f(f(k,v),p.$)),function(e){if(!e.length)return l;const t=e.length/s|0,n=new Uint8Array(s),i=new Uint8Array(s);for(let a=0;a<t;a++)f(n,p[c(a+1)]),f(i,r(d(n,e))),e=e.subarray(s);if(e.length){f(n,p.x);const t=new Uint8Array(s);t.set(e,0),t[e.length]=128,f(t,n),f(i,r(t))}return i}(a));return A.set(P,E),A}return function(e,t){const s=new n.default[e](t);r=s.encrypt.bind(s),a=s.decrypt.bind(s);const o=r(l),u=i.default.double(o);(p=[])[0]=i.default.double(u),p.x=o,p.$=u}(e,t),{encrypt:async function(e,t,n){return b(r,e,t,n)},decrypt:async function(e,t,r){if(e.length<u)throw new Error("Invalid OCB ciphertext");const n=e.subarray(-u);e=e.subarray(0,-u);const s=b(a,e,t,r);if(i.default.equalsUint8Array(n,s.subarray(-u)))return s.subarray(0,-u);throw new Error("Authentication tag mismatch")}}}p.getNonce=function(e,t){const r=e.slice();for(let n=0;n<t.length;n++)r[7+n]^=t[n];return r},p.blockLength=s,p.ivLength=o,p.tagLength=u,r.default=p},{"../util":154,"./cipher":88}],98:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=s(e("./random")),i=s(e("./hash")),a=s(e("../util"));function s(e){return e&&e.__esModule?e:{default:e}}const o={},u={},c=[];c[1]=[48,32,48,12,6,8,42,134,72,134,247,13,2,5,5,0,4,16],c[2]=[48,33,48,9,6,5,43,14,3,2,26,5,0,4,20],c[3]=[48,33,48,9,6,5,43,36,3,2,1,5,0,4,20],c[8]=[48,49,48,13,6,9,96,134,72,1,101,3,4,2,1,5,0,4,32],c[9]=[48,65,48,13,6,9,96,134,72,1,101,3,4,2,2,5,0,4,48],c[10]=[48,81,48,13,6,9,96,134,72,1,101,3,4,2,3,5,0,4,64],c[11]=[48,45,48,13,6,9,96,134,72,1,101,3,4,2,4,5,0,4,28],o.encode=async function(e,t){const r=e.length;if(r>t-11)throw new Error("Message too long");const i=await async function(e){let t="";for(;t.length<e;){const r=await n.default.getRandomBytes(e-t.length);for(let e=0;e<r.length;e++)0!==r[e]&&(t+=String.fromCharCode(r[e]))}return t}(t-r-3);return String.fromCharCode(0)+String.fromCharCode(2)+i+String.fromCharCode(0)+e},o.decode=function(e){0!==e.charCodeAt(0)&&(e=String.fromCharCode(0)+e);const t=e.charCodeAt(0),r=e.charCodeAt(1);let n=2;for(;0!==e.charCodeAt(n)&&n<e.length;)n++;const i=n-2,a=e.charCodeAt(n++);if(0===t&&2===r&&i>=8&&0===a)return e.substr(n);throw new Error("Decryption error")},u.encode=async function(e,t,r){let n;const s=a.default.Uint8Array_to_str(t);if(s.length!==i.default.getHashByteLength(e))throw new Error("Invalid hash length");let o="";for(n=0;n<c[e].length;n++)o+=String.fromCharCode(c[e][n]);const u=(o+=s).length;if(r<u+11)throw new Error("Intended encoded message length too short");let f="";for(n=0;n<r-u-3;n++)f+=String.fromCharCode(255);const d=String.fromCharCode(0)+String.fromCharCode(1)+f+String.fromCharCode(0)+o;return a.default.str_to_hex(d)},r.default={eme:o,emsa:u}},{"../util":154,"./hash":94,"./random":111}],99:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.default={encode:function(e){const t=8-e.length%8;return e+String.fromCharCode(t).repeat(t)},decode:function(e){const t=e.length;if(t>0){const r=e.charCodeAt(t-1);if(r>=1&&r<=8&&e.substr(t-r)===String.fromCharCode(r).repeat(r))return e.substr(0,t-r)}throw new Error("Invalid padding")}}},{}],100:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=s(e("bn.js")),i=s(e("../random")),a=s(e("../../util"));function s(e){return e&&e.__esModule?e:{default:e}}const o=new n.default(1),u=new n.default(0);r.default={sign:async function(e,t,r,s,c,f){let d,l,h,p;const y=new n.default.red(s),b=new n.default.red(c),m=r.toRed(y),g=f.toRed(b),w=new n.default(a.default.getLeftNBits(t,c.bitLength())).toRed(b);for(;d=await i.default.getRandomBN(o,c),l=m.redPow(d).fromRed().toRed(b),0===u.cmp(l)||(p=w.redAdd(g.redMul(l)),h=d.toRed(b).redInvm().redMul(p),0===u.cmp(h)););return{r:l.toArrayLike(Uint8Array),s:h.toArrayLike(Uint8Array)}},verify:async function(e,t,r,i,s,o,c,f){if(u.ucmp(t)>=0||t.ucmp(c)>=0||u.ucmp(r)>=0||r.ucmp(c)>=0)return a.default.print_debug("invalid DSA Signature"),null;const d=new n.default.red(o),l=new n.default.red(c),h=new n.default(a.default.getLeftNBits(i,c.bitLength())),p=r.toRed(l).redInvm();if(0===u.cmp(p))return a.default.print_debug("invalid DSA Signature"),null;const y=h.toRed(l).redMul(p),b=t.toRed(l).redMul(p),m=s.toRed(d).redPow(y.fromRed()),g=f.toRed(d).redPow(b.fromRed());return 0===m.redMul(g).fromRed().mod(c).cmp(t)}}},{"../../util":154,"../random":111,"bn.js":17}],101:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("bn.js")),i=a(e("../random"));function a(e){return e&&e.__esModule?e:{default:e}}const s=new n.default(0);r.default={encrypt:async function(e,t,r,a){const o=new n.default.red(t),u=e.toRed(o),c=r.toRed(o),f=a.toRed(o),d=await i.default.getRandomBN(s,t);return{c1:c.redPow(d).fromRed(),c2:f.redPow(d).redMul(u).fromRed()}},decrypt:async function(e,t,r,i){const a=new n.default.red(r),s=e.toRed(a),o=t.toRed(a);return s.redPow(i).redInvm().redMul(o).fromRed()}}},{"../random":111,"bn.js":17}],102:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.getPreferredHashAlgo=r.generate=r.nodeCurves=r.webCurves=r.curves=void 0;var n=f(e("bn.js")),i=e("elliptic"),a=f(e("./key")),s=f(e("../../random")),o=f(e("../../../enums")),u=f(e("../../../util")),c=f(e("../../../type/oid"));function f(e){return e&&e.__esModule?e:{default:e}}const d=u.default.getWebCrypto(),l=u.default.getNodeCrypto(),h={p256:"P-256",p384:"P-384",p521:"P-521"},p=l?l.getCurves():[],y=l?{secp256k1:p.includes("secp256k1")?"secp256k1":void 0,p256:p.includes("prime256v1")?"prime256v1":void 0,p384:p.includes("secp384r1")?"secp384r1":void 0,p521:p.includes("secp521r1")?"secp521r1":void 0,ed25519:p.includes("ED25519")?"ED25519":void 0,curve25519:p.includes("X25519")?"X25519":void 0,brainpoolP256r1:p.includes("brainpoolP256r1")?"brainpoolP256r1":void 0,brainpoolP384r1:p.includes("brainpoolP384r1")?"brainpoolP384r1":void 0,brainpoolP512r1:p.includes("brainpoolP512r1")?"brainpoolP512r1":void 0}:{},b={p256:{oid:[6,8,42,134,72,206,61,3,1,7],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha256,cipher:o.default.symmetric.aes128,node:y.p256,web:h.p256,payloadSize:32},p384:{oid:[6,5,43,129,4,0,34],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha384,cipher:o.default.symmetric.aes192,node:y.p384,web:h.p384,payloadSize:48},p521:{oid:[6,5,43,129,4,0,35],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha512,cipher:o.default.symmetric.aes256,node:y.p521,web:h.p521,payloadSize:66},secp256k1:{oid:[6,5,43,129,4,0,10],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha256,cipher:o.default.symmetric.aes128,node:y.secp256k1},ed25519:{oid:[6,9,43,6,1,4,1,218,71,15,1],keyType:o.default.publicKey.eddsa,hash:o.default.hash.sha512,node:!1},curve25519:{oid:[6,10,43,6,1,4,1,151,85,1,5,1],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha256,cipher:o.default.symmetric.aes128,node:!1},brainpoolP256r1:{oid:[6,9,43,36,3,3,2,8,1,1,7],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha256,cipher:o.default.symmetric.aes128,node:y.brainpoolP256r1},brainpoolP384r1:{oid:[6,9,43,36,3,3,2,8,1,1,11],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha384,cipher:o.default.symmetric.aes192,node:y.brainpoolP384r1},brainpoolP512r1:{oid:[6,9,43,36,3,3,2,8,1,1,13],keyType:o.default.publicKey.ecdsa,hash:o.default.hash.sha512,cipher:o.default.symmetric.aes256,node:y.brainpoolP512r1}};function m(e,t){try{(u.default.isArray(e)||u.default.isUint8Array(e))&&(e=new c.default(e)),e instanceof c.default&&(e=e.getName()),this.name=o.default.write(o.default.curve,e)}catch(r){throw new Error("Not valid curve")}switch(t=t||b[this.name],this.keyType=t.keyType,this.keyType){case o.default.publicKey.ecdsa:this.curve=new i.ec(this.name);break;case o.default.publicKey.eddsa:this.curve=new i.eddsa(this.name);break;default:throw new Error("Unknown elliptic key type;")}this.oid=t.oid,this.hash=t.hash,this.cipher=t.cipher,this.node=t.node&&b[this.name],this.web=t.web&&b[this.name],this.payloadSize=t.payloadSize}m.prototype.keyFromPrivate=function(e){return new a.default(this,{priv:e})},m.prototype.keyFromSecret=function(e){return new a.default(this,{secret:e})},m.prototype.keyFromPublic=function(e){const t=new a.default(this,{pub:e});if(this.keyType===o.default.publicKey.ecdsa&&!0!==t.keyPair.validate().result)throw new Error("Invalid elliptic public key");return t},m.prototype.genKeyPair=async function(){let e;if(this.web&&u.default.getWebCrypto())try{e=await async function(e){const t=await d.generateKey({name:"ECDSA",namedCurve:h[e]},!0,["sign","verify"]),r=await d.exportKey("jwk",t.privateKey),n=await d.exportKey("jwk",t.publicKey);return{pub:{x:u.default.b64_to_Uint8Array(n.x,!0),y:u.default.b64_to_Uint8Array(n.y,!0)},priv:u.default.b64_to_Uint8Array(r.d,!0)}}(this.name)}catch(t){u.default.print_debug("Browser did not support signing: "+t.message)}else this.node&&u.default.getNodeCrypto()&&(e=await async function(e){const t=l.createECDH(y[e]);return await t.generateKeys(),{pub:t.getPublicKey().toJSON().data,priv:t.getPrivateKey().toJSON().data}}(this.name));if(!e||!e.priv){const t=await this.curve.genKeyPair({entropy:u.default.Uint8Array_to_str(await s.default.getRandomBytes(32))}),r="edwards"===this.curve.curve.type||"mont"===this.curve.curve.type;e=this.keyType===o.default.publicKey.eddsa?{secret:t.getSecret()}:{pub:t.getPublic("array",r),priv:t.getPrivate().toArray()}}return new a.default(this,e)},r.default=m,r.curves=b,r.webCurves=h,r.nodeCurves=y,r.generate=async function(e){e=new m(e);const t=await e.genKeyPair();return{oid:e.oid,Q:new n.default(t.getPublic()),d:new n.default(t.getPrivate()),hash:e.hash,cipher:e.cipher}},r.getPreferredHashAlgo=function(e){return b[o.default.write(o.default.curve,e.toHex())].hash}},{"../../../enums":115,"../../../type/oid":152,"../../../util":154,"../../random":111,"./key":107,"bn.js":17,elliptic:19}],103:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=d(e("bn.js")),i=d(e("./curves")),a=d(e("../../aes_kw")),s=d(e("../../cipher")),o=d(e("../../hash")),u=d(e("../../../type/kdf_params")),c=d(e("../../../enums")),f=d(e("../../../util"));function d(e){return e&&e.__esModule?e:{default:e}}function l(e,t,r,n,i){const a=new u.default([n,r]);return f.default.concatUint8Array([t.write(),new Uint8Array([e]),a.write(),f.default.str_to_Uint8Array("Anonymous Sender    "),i.subarray(0,20)])}async function h(e,t,r,n,i,a){const s=a?t.byteLength():i.curve.curve.p.byteLength(),u="mont"===i.curve.curve.type?t.toArrayLike(Uint8Array,"le",s):t.toArrayLike(Uint8Array,"be",s);return(await o.default.digest(e,f.default.concatUint8Array([new Uint8Array([0,0,0,1]),u,n]))).subarray(0,r)}async function p(e,t){const r=await e.genKeyPair();return t=e.keyFromPublic(t),{V:new Uint8Array(r.getPublic()),S:r.derive(t)}}async function y(e,t,r){return t=e.keyFromPublic(t),(r=e.keyFromPrivate(r)).derive(t)}r.default={encrypt:async function(e,t,r,n,o,u){const f=new i.default(e);var d=await p(f,o);const y=d.V,b=d.S,m=l(c.default.publicKey.ecdh,e,t,r,u);t=c.default.read(c.default.symmetric,t);const g=await h(r,b,s.default[t].keySize,m,f,!1);return{V:y,C:a.default.wrap(g,n.toString())}},decrypt:async function(e,t,r,o,u,f,d){const p=new i.default(e),b=await y(p,o,f),m=l(c.default.publicKey.ecdh,e,t,r,d);t=c.default.read(c.default.symmetric,t);try{const e=await h(r,b,s.default[t].keySize,m,p,!1);return new n.default(a.default.unwrap(e,u))}catch(w){}const g=await h(r,b,s.default[t].keySize,m,p,!0);return new n.default(a.default.unwrap(g,u))},genPublicEphemeralKey:p,genPrivateEphemeralKey:y,buildEcdhParam:l,kdf:h}},{"../../../enums":115,"../../../type/kdf_params":149,"../../../util":154,"../../aes_kw":82,"../../cipher":88,"../../hash":94,"./curves":102,"bn.js":17}],104:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("./curves"),a=(n=i)&&n.__esModule?n:{default:n};r.default={sign:async function(e,t,r,n,i){const s=new a.default(e).keyFromPrivate(n),o=await s.sign(r,t,i);return{r:o.r.toArrayLike(Uint8Array),s:o.s.toArrayLike(Uint8Array)}},verify:async function(e,t,r,n,i,s){return new a.default(e).keyFromPublic(i).verify(n,r,t,s)}}},{"./curves":102}],105:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("./curves"),a=(n=i)&&n.__esModule?n:{default:n};r.default={sign:async function(e,t,r,n,i){const s=new a.default(e).keyFromSecret(n),o=await s.sign(r,t,i);return{R:new Uint8Array(o.Rencoded()),S:new Uint8Array(o.Sencoded())}},verify:async function(e,t,r,n,i,s){return new a.default(e).keyFromPublic(i).verify(n,r,t,s)}}},{"./curves":102}],106:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("./curves"),i=u(n),a=u(e("./ecdsa")),s=u(e("./eddsa")),o=u(e("./ecdh"));function u(e){return e&&e.__esModule?e:{default:e}}r.default={Curve:i.default,ecdh:o.default,ecdsa:a.default,eddsa:s.default,generate:n.generate,getPreferredHashAlgo:n.getPreferredHashAlgo}},{"./curves":102,"./ecdh":103,"./ecdsa":104,"./eddsa":105}],107:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("bn.js")),i=u(e("web-stream-tools")),a=e("./curves"),s=u(e("../../../util")),o=u(e("../../../enums"));function u(e){return e&&e.__esModule?e:{default:e}}const c=s.default.getWebCrypto(),f=s.default.getNodeCrypto();function d(e,t){this.curve=e,this.keyType="edwards"===e.curve.type?o.default.publicKey.eddsa:o.default.publicKey.ecdsa,this.keyPair=this.curve.curve.keyPair(t)}d.prototype.sign=async function(e,t,r){if(e&&!e.locked)if(e=await i.default.readToEnd(e),this.curve.web&&s.default.getWebCrypto())try{return await async function(e,t,r,i){const u=e.payloadSize,f=await c.importKey("jwk",{kty:"EC",crv:a.webCurves[e.name],x:s.default.Uint8Array_to_b64(new Uint8Array(i.getPublic().getX().toArray("be",u)),!0),y:s.default.Uint8Array_to_b64(new Uint8Array(i.getPublic().getY().toArray("be",u)),!0),d:s.default.Uint8Array_to_b64(new Uint8Array(i.getPrivate().toArray("be",u)),!0),use:"sig",kid:"ECDSA Private Key"},{name:"ECDSA",namedCurve:a.webCurves[e.name],hash:{name:o.default.read(o.default.webHash,e.hash)}},!1,["sign"]),d=new Uint8Array(await c.sign({name:"ECDSA",namedCurve:a.webCurves[e.name],hash:{name:o.default.read(o.default.webHash,t)}},f,r));return{r:new n.default(d.slice(0,u)),s:new n.default(d.slice(u,u<<1))}}(this.curve,t,e,this.keyPair)}catch(d){s.default.print_debug("Browser did not support signing: "+d.message)}else if(this.curve.node&&s.default.getNodeCrypto())return async function(e,t,r,n){const i=f.createSign(o.default.read(o.default.hash,t));i.write(r),i.end();const a=p.encode({version:1,parameters:e.oid,privateKey:n.getPrivate().toArray(),publicKey:{unused:0,data:n.getPublic().encode()}},"pem",{label:"EC PRIVATE KEY"});return h.decode(i.sign(a),"der")}(this.curve,t,e,this.keyPair);const u=void 0===t?e:r;return this.keyPair.sign(u)},d.prototype.verify=async function(e,t,r,u){if(e&&!e.locked)if(e=await i.default.readToEnd(e),this.curve.web&&s.default.getWebCrypto())try{return await async function(e,t,{r:r,s:n},i,u){const f=e.payloadSize,d=await c.importKey("jwk",{kty:"EC",crv:a.webCurves[e.name],x:s.default.Uint8Array_to_b64(new Uint8Array(u.getX().toArray("be",f)),!0),y:s.default.Uint8Array_to_b64(new Uint8Array(u.getY().toArray("be",f)),!0),use:"sig",kid:"ECDSA Public Key"},{name:"ECDSA",namedCurve:a.webCurves[e.name],hash:{name:o.default.read(o.default.webHash,e.hash)}},!1,["verify"]),l=s.default.concatUint8Array([new Uint8Array(f-r.length),r,new Uint8Array(f-n.length),n]).buffer;return c.verify({name:"ECDSA",namedCurve:a.webCurves[e.name],hash:{name:o.default.read(o.default.webHash,t)}},d,l,i)}(this.curve,r,t,e,this.keyPair.getPublic())}catch(l){s.default.print_debug("Browser did not support signing: "+l.message)}else if(this.curve.node&&s.default.getNodeCrypto())return async function(e,t,{r:r,s:i},a,s){const u=f.createVerify(o.default.read(o.default.hash,t));u.write(a),u.end();const c=b.encode({algorithm:{algorithm:[1,2,840,10045,2,1],parameters:e.oid},subjectPublicKey:{unused:0,data:s.encode()}},"pem",{label:"PUBLIC KEY"}),d=h.encode({r:new n.default(r),s:new n.default(i)},"der");try{return u.verify(c,d)}catch(l){return!1}}(this.curve,r,t,e,this.keyPair.getPublic());const d=void 0===r?e:u;return this.keyPair.verify(d,t)},d.prototype.derive=function(e){if(this.keyType===o.default.publicKey.eddsa)throw new Error("Key can only be used for EdDSA");return this.keyPair.derive(e.keyPair.getPublic())},d.prototype.getPublic=function(){const e="edwards"===this.curve.curve.curve.type||"mont"===this.curve.curve.curve.type;return this.keyPair.getPublic("array",e)},d.prototype.getPrivate=function(){return this.curve.keyType===o.default.publicKey.eddsa?this.keyPair.getSecret():this.keyPair.getPrivate().toArray()},r.default=d;const l=f?e("asn1.js"):void 0,h=f?l.define("ECDSASignature",function(){this.seq().obj(this.key("r").int(),this.key("s").int())}):void 0,p=f?l.define("ECPrivateKey",function(){this.seq().obj(this.key("version").int(),this.key("privateKey").octstr(),this.key("parameters").explicit(0).optional().any(),this.key("publicKey").explicit(1).optional().bitstr())}):void 0,y=f?l.define("AlgorithmIdentifier",function(){this.seq().obj(this.key("algorithm").objid(),this.key("parameters").optional().any())}):void 0,b=f?l.define("SubjectPublicKeyInfo",function(){this.seq().obj(this.key("algorithm").use(y),this.key("subjectPublicKey").bitstr())}):void 0},{"../../../enums":115,"../../../util":154,"./curves":102,"asn1.js":"asn1.js","bn.js":17,"web-stream-tools":77}],108:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=o(e("./rsa")),i=o(e("./elgamal")),a=o(e("./elliptic")),s=o(e("./dsa"));function o(e){return e&&e.__esModule?e:{default:e}}r.default={rsa:n.default,elgamal:i.default,elliptic:a.default,dsa:s.default}},{"./dsa":100,"./elgamal":101,"./elliptic":106,"./rsa":110}],109:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("bn.js")),i=a(e("../random"));function a(e){return e&&e.__esModule?e:{default:e}}async function s(e,t,r){return!(t&&!e.subn(1).gcd(t).eqn(1))&&(!!u(e)&&(!!o(e)&&!!(await f(e,r))))}function o(e,t){return 0===(t=t||new n.default(2)).toRed(n.default.mont(e)).redPow(e.subn(1)).fromRed().cmpn(1)}function u(e){return c.every(t=>0!==e.modn(t))}r.default={randomProbablePrime:async function(e,t,r){const a=new n.default(1).shln(e-1),o=new n.default(30),u=[1,6,5,4,3,2,1,4,3,2,1,2,1,4,3,2,1,2,1,4,3,2,1,6,5,4,3,2,1,2];let c=await i.default.getRandomBN(a,a.shln(1)),f=c.mod(o).toNumber();do{c.iaddn(u[f]),f=(f+u[f])%u.length,c.bitLength()>e&&(c=c.mod(a.shln(1)).iadd(a),f=c.mod(o).toNumber())}while(!(await s(c,t,r)));return c},isProbablePrime:s,fermat:o,millerRabin:f,divisionTest:u};const c=[7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997,1009,1013,1019,1021,1031,1033,1039,1049,1051,1061,1063,1069,1087,1091,1093,1097,1103,1109,1117,1123,1129,1151,1153,1163,1171,1181,1187,1193,1201,1213,1217,1223,1229,1231,1237,1249,1259,1277,1279,1283,1289,1291,1297,1301,1303,1307,1319,1321,1327,1361,1367,1373,1381,1399,1409,1423,1427,1429,1433,1439,1447,1451,1453,1459,1471,1481,1483,1487,1489,1493,1499,1511,1523,1531,1543,1549,1553,1559,1567,1571,1579,1583,1597,1601,1607,1609,1613,1619,1621,1627,1637,1657,1663,1667,1669,1693,1697,1699,1709,1721,1723,1733,1741,1747,1753,1759,1777,1783,1787,1789,1801,1811,1823,1831,1847,1861,1867,1871,1873,1877,1879,1889,1901,1907,1913,1931,1933,1949,1951,1973,1979,1987,1993,1997,1999,2003,2011,2017,2027,2029,2039,2053,2063,2069,2081,2083,2087,2089,2099,2111,2113,2129,2131,2137,2141,2143,2153,2161,2179,2203,2207,2213,2221,2237,2239,2243,2251,2267,2269,2273,2281,2287,2293,2297,2309,2311,2333,2339,2341,2347,2351,2357,2371,2377,2381,2383,2389,2393,2399,2411,2417,2423,2437,2441,2447,2459,2467,2473,2477,2503,2521,2531,2539,2543,2549,2551,2557,2579,2591,2593,2609,2617,2621,2633,2647,2657,2659,2663,2671,2677,2683,2687,2689,2693,2699,2707,2711,2713,2719,2729,2731,2741,2749,2753,2767,2777,2789,2791,2797,2801,2803,2819,2833,2837,2843,2851,2857,2861,2879,2887,2897,2903,2909,2917,2927,2939,2953,2957,2963,2969,2971,2999,3001,3011,3019,3023,3037,3041,3049,3061,3067,3079,3083,3089,3109,3119,3121,3137,3163,3167,3169,3181,3187,3191,3203,3209,3217,3221,3229,3251,3253,3257,3259,3271,3299,3301,3307,3313,3319,3323,3329,3331,3343,3347,3359,3361,3371,3373,3389,3391,3407,3413,3433,3449,3457,3461,3463,3467,3469,3491,3499,3511,3517,3527,3529,3533,3539,3541,3547,3557,3559,3571,3581,3583,3593,3607,3613,3617,3623,3631,3637,3643,3659,3671,3673,3677,3691,3697,3701,3709,3719,3727,3733,3739,3761,3767,3769,3779,3793,3797,3803,3821,3823,3833,3847,3851,3853,3863,3877,3881,3889,3907,3911,3917,3919,3923,3929,3931,3943,3947,3967,3989,4001,4003,4007,4013,4019,4021,4027,4049,4051,4057,4073,4079,4091,4093,4099,4111,4127,4129,4133,4139,4153,4157,4159,4177,4201,4211,4217,4219,4229,4231,4241,4243,4253,4259,4261,4271,4273,4283,4289,4297,4327,4337,4339,4349,4357,4363,4373,4391,4397,4409,4421,4423,4441,4447,4451,4457,4463,4481,4483,4493,4507,4513,4517,4519,4523,4547,4549,4561,4567,4583,4591,4597,4603,4621,4637,4639,4643,4649,4651,4657,4663,4673,4679,4691,4703,4721,4723,4729,4733,4751,4759,4783,4787,4789,4793,4799,4801,4813,4817,4831,4861,4871,4877,4889,4903,4909,4919,4931,4933,4937,4943,4951,4957,4967,4969,4973,4987,4993,4999];async function f(e,t,r){const a=e.bitLength(),s=n.default.mont(e),o=new n.default(1).toRed(s);t||(t=Math.max(1,a/48|0));const u=e.subn(1),c=u.toRed(s);let f=0;for(;!u.testn(f);)f++;const d=e.shrn(f);for(;t>0;t--){let e,t=(r?r():await i.default.getRandomBN(new n.default(2),u)).toRed(s).redPow(d);if(!t.eq(o)&&!t.eq(c)){for(e=1;e<f;e++){if((t=t.redSqr()).eq(o))return!1;if(t.eq(c))break}if(e===f)return!1}}return!0}},{"../random":111,"bn.js":17}],110:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("bn.js")),i=u(e("./prime")),a=u(e("../random")),s=u(e("../../config")),o=u(e("../../util"));function u(e){return e&&e.__esModule?e:{default:e}}function c(e,t){return"function"!=typeof e.then?new Promise(function(r,n){e.onerror=function(){n(new Error(t))},e.oncomplete=function(e){r(e.target.result)}}):e}r.default={sign:async function(e,t,r,i){if(t.cmp(e)<=0)throw new Error("Message size cannot exceed modulus size");const a=new n.default.red(t);return e.toRed(a).redPow(i).toArrayLike(Uint8Array,"be",t.byteLength())},verify:async function(e,t,r){if(t.cmp(e)<=0)throw new Error("Signature size cannot exceed modulus size");const i=new n.default.red(t);return e.toRed(i).redPow(r).toArrayLike(Uint8Array,"be",t.byteLength())},encrypt:async function(e,t,r){if(t.cmp(e)<=0)throw new Error("Message size cannot exceed modulus size");const i=new n.default.red(t);return e.toRed(i).redPow(r).toArrayLike(Uint8Array,"be",t.byteLength())},decrypt:async function(e,t,r,i,o,u,c){if(t.cmp(e)<=0)throw new Error("Data too large.");const f=i.mod(u.subn(1)),d=i.mod(o.subn(1)),l=new n.default.red(o),h=new n.default.red(u),p=new n.default.red(t);let y,b;s.default.rsa_blinding&&(y=(b=(await a.default.getRandomBN(new n.default(2),t)).toRed(p)).redInvm().redPow(r),e=e.toRed(p).redMul(y).fromRed());const m=e.toRed(l).redPow(d),g=e.toRed(h).redPow(f).redSub(m.fromRed().toRed(h));let w=c.toRed(h).redMul(g).fromRed().mul(o).add(m).toRed(p);return s.default.rsa_blinding&&(w=w.redMul(b)),w.toArrayLike(Uint8Array,"be",t.byteLength())},generate:async function(e,t){let r;t=new n.default(t,16);const a=o.default.getWebCryptoAll();if(a){let i,s;if(window.crypto&&window.crypto.subtle||window.msCrypto)s={name:"RSASSA-PKCS1-v1_5",modulusLength:e,publicExponent:t.toArrayLike(Uint8Array),hash:{name:"SHA-1"}},i=a.generateKey(s,!0,["sign","verify"]),i=await c(i,"Error generating RSA key pair.");else{if(!window.crypto||!window.crypto.webkitSubtle)throw new Error("Unknown WebCrypto implementation");s={name:"RSA-OAEP",modulusLength:e,publicExponent:t.toArrayLike(Uint8Array),hash:{name:"SHA-1"}},i=await a.generateKey(s,!0,["encrypt","decrypt"])}let u=a.exportKey("jwk",i.privateKey);return(u=await c(u,"Error exporting RSA key pair."))instanceof ArrayBuffer&&(u=JSON.parse(String.fromCharCode.apply(null,new Uint8Array(u)))),(r={}).n=new n.default(o.default.b64_to_Uint8Array(u.n)),r.e=t,r.d=new n.default(o.default.b64_to_Uint8Array(u.d)),r.p=new n.default(o.default.b64_to_Uint8Array(u.p)),r.q=new n.default(o.default.b64_to_Uint8Array(u.q)),r.u=r.p.invm(r.q),r}let s=await i.default.randomProbablePrime(e-(e>>1),t,40),u=await i.default.randomProbablePrime(e>>1,t,40);if(s.cmp(u)<0){var f=[u,s];s=f[0],u=f[1]}const d=s.subn(1).mul(u.subn(1));return{n:s.mul(u),e:t,d:t.invm(d),p:s,q:u,u:s.invm(u)}},prime:i.default}},{"../../config":81,"../../util":154,"../random":111,"./prime":109,"bn.js":17}],111:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=i(e("bn.js"));function i(e){return e&&e.__esModule?e:{default:e}}const a=i(e("../util")).default.detectNode()&&e("crypto");function s(){this.buffer=null,this.size=null,this.callback=null}r.default={getRandomBytes:async function(e){const t=new Uint8Array(e);if("undefined"!=typeof window&&window.crypto&&window.crypto.getRandomValues)window.crypto.getRandomValues(t);else if("undefined"!=typeof window&&"object"==typeof window.msCrypto&&"function"==typeof window.msCrypto.getRandomValues)window.msCrypto.getRandomValues(t);else if(a){const e=a.randomBytes(t.length);t.set(e)}else{if(!this.randomBuffer.buffer)throw new Error("No secure random number generator available.");await this.randomBuffer.get(t)}return t},getRandomBN:async function(e,t){if(t.cmp(e)<=0)throw new Error("Illegal parameter value: max <= min");const r=t.sub(e),i=r.byteLength();return new n.default(await this.getRandomBytes(i+8)).mod(r).add(e)},randomBuffer:new s},s.prototype.init=function(e,t){this.buffer=new Uint8Array(e),this.size=0,this.callback=t},s.prototype.set=function(e){if(!this.buffer)throw new Error("RandomBuffer is not initialized");if(!(e instanceof Uint8Array))throw new Error("Invalid type: buf not an Uint8Array");const t=this.buffer.length-this.size;e.length>t&&(e=e.subarray(0,t)),this.buffer.set(e,this.size),this.size+=e.length},s.prototype.get=async function(e){if(!this.buffer)throw new Error("RandomBuffer is not initialized");if(!(e instanceof Uint8Array))throw new Error("Invalid type: buf not an Uint8Array");if(this.size<e.length){if(!this.callback)throw new Error("Random number buffer depleted");return await this.callback(),this.get(e)}for(let t=0;t<e.length;t++)e[t]=this.buffer[--this.size],this.buffer[this.size]=0}},{"../util":154,"bn.js":17,crypto:"crypto"}],112:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("bn.js")),i=u(e("./public_key")),a=u(e("./pkcs1")),s=u(e("../enums")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}r.default={verify:async function(e,t,r,n,u,c){switch(e){case s.default.publicKey.rsa_encrypt_sign:case s.default.publicKey.rsa_encrypt:case s.default.publicKey.rsa_sign:{const e=r[0].toBN(),s=n[0].toBN(),u=n[1].toBN(),f=await i.default.rsa.verify(e,s,u),d=await a.default.emsa.encode(t,c,s.byteLength());return o.default.Uint8Array_to_hex(f)===d}case s.default.publicKey.dsa:{const e=r[0].toBN(),a=r[1].toBN(),s=n[0].toBN(),o=n[1].toBN(),u=n[2].toBN(),f=n[3].toBN();return i.default.dsa.verify(t,e,a,c,u,s,o,f)}case s.default.publicKey.ecdsa:{const e=n[0],a={r:r[0].toUint8Array(),s:r[1].toUint8Array()},s=n[1].toUint8Array();return i.default.elliptic.ecdsa.verify(e,t,a,u,s,c)}case s.default.publicKey.eddsa:{const e=n[0],a={R:Array.from(r[0].toUint8Array("le",32)),S:Array.from(r[1].toUint8Array("le",32))},s=Array.from(n[1].toUint8Array("be",33));return i.default.elliptic.eddsa.verify(e,t,a,u,s,c)}default:throw new Error("Invalid signature algorithm.")}},sign:async function(e,t,r,u,c){switch(e){case s.default.publicKey.rsa_encrypt_sign:case s.default.publicKey.rsa_encrypt:case s.default.publicKey.rsa_sign:{const e=r[0].toBN(),s=r[1].toBN(),u=r[2].toBN(),f=new n.default(await a.default.emsa.encode(t,c,e.byteLength()),16),d=await i.default.rsa.sign(f,e,s,u);return o.default.Uint8Array_to_MPI(d)}case s.default.publicKey.dsa:{const e=r[0].toBN(),n=r[1].toBN(),a=r[2].toBN(),s=r[4].toBN(),u=await i.default.dsa.sign(t,c,a,e,n,s);return o.default.concatUint8Array([o.default.Uint8Array_to_MPI(u.r),o.default.Uint8Array_to_MPI(u.s)])}case s.default.publicKey.elgamal:throw new Error("Signing with Elgamal is not defined in the OpenPGP standard.");case s.default.publicKey.ecdsa:{const e=r[0],n=r[2].toUint8Array(),a=await i.default.elliptic.ecdsa.sign(e,t,u,n,c);return o.default.concatUint8Array([o.default.Uint8Array_to_MPI(a.r),o.default.Uint8Array_to_MPI(a.s)])}case s.default.publicKey.eddsa:{const e=r[0],n=Array.from(r[2].toUint8Array("be",32)),a=await i.default.elliptic.eddsa.sign(e,t,u,n,c);return o.default.concatUint8Array([o.default.Uint8Array_to_MPI(a.R),o.default.Uint8Array_to_MPI(a.S)])}default:throw new Error("Invalid signature algorithm.")}}}},{"../enums":115,"../util":154,"./pkcs1":98,"./public_key":108,"bn.js":17}],113:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("web-stream-tools")),i=u(e("./base64.js")),a=u(e("../enums.js")),s=u(e("../config")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}function c(e){const t=e.match(/^-----BEGIN PGP (MESSAGE, PART \d+\/\d+|MESSAGE, PART \d+|SIGNED MESSAGE|MESSAGE|PUBLIC KEY BLOCK|PRIVATE KEY BLOCK|SIGNATURE)-----$/m);if(!t)throw new Error("Unknown ASCII armor type");return/MESSAGE, PART \d+\/\d+/.test(t[1])?a.default.armor.multipart_section:/MESSAGE, PART \d+/.test(t[1])?a.default.armor.multipart_last:/SIGNED MESSAGE/.test(t[1])?a.default.armor.signed:/MESSAGE/.test(t[1])?a.default.armor.message:/PUBLIC KEY BLOCK/.test(t[1])?a.default.armor.public_key:/PRIVATE KEY BLOCK/.test(t[1])?a.default.armor.private_key:/SIGNATURE/.test(t[1])?a.default.armor.signature:void 0}function f(e){let t="";return s.default.show_version&&(t+="Version: "+s.default.versionstring+"\r\n"),s.default.show_comment&&(t+="Comment: "+s.default.commentstring+"\r\n"),e&&(t+="Comment: "+e+"\r\n"),t+="\r\n"}function d(e){const t=function(e){let t=11994318;return n.default.transform(e,e=>{for(let r=0;r<e.length;r++)t=t<<8^l[255&(t>>16^e[r])]},()=>new Uint8Array([t>>16,t>>8,t]))}(e);return i.default.encode(t)}const l=[0,8801531,25875725,17603062,60024545,51751450,35206124,44007191,128024889,120049090,103502900,112007375,70412248,78916387,95990485,88014382,264588937,256049778,240098180,248108927,207005800,215016595,232553829,224014750,140824496,149062475,166599357,157832774,200747345,191980970,176028764,184266919,520933865,529177874,512099556,503334943,480196360,471432179,487973381,496217854,414011600,405478443,422020573,430033190,457094705,465107658,448029500,439496647,281648992,273666971,289622637,298124950,324696449,333198714,315665548,307683447,392699481,401494690,383961940,375687087,352057528,343782467,359738805,368533838,1041867730,1050668841,1066628831,1058355748,1032471859,1024199112,1006669886,1015471301,968368875,960392720,942864358,951368477,975946762,984451313,1000411399,992435708,836562267,828023200,810956886,818967725,844041146,852051777,868605623,860066380,914189410,922427545,938981743,930215316,904825475,896059e3,878993294,887231349,555053627,563297984,547333942,538569677,579245274,570480673,588005847,596249900,649392898,640860153,658384399,666397428,623318499,631331096,615366894,606833685,785398962,777416777,794487231,802989380,759421523,767923880,751374174,743392165,695319947,704115056,687564934,679289981,719477610,711202705,728272487,737067676,2083735460,2092239711,2109313705,2101337682,2141233477,2133257662,2116711496,2125215923,2073216669,2064943718,2048398224,2057199467,2013339772,2022141063,2039215473,2030942602,1945504045,1936737750,1920785440,1929023707,1885728716,1893966647,1911503553,1902736954,1951893524,1959904495,1977441561,1968902626,2009362165,2000822798,1984871416,1992881923,1665111629,1673124534,1656046400,1647513531,1621913772,1613380695,1629922721,1637935450,1688082292,1679317903,1695859321,1704103554,1728967061,1737211246,1720132760,1711368291,1828378820,1820103743,1836060105,1844855090,1869168165,1877963486,1860430632,1852155859,1801148925,1809650950,1792118e3,1784135691,1757986588,1750004711,1765960209,1774462698,1110107254,1118611597,1134571899,1126595968,1102643863,1094667884,1077139354,1085643617,1166763343,1158490548,1140961346,1149762745,1176011694,1184812885,1200772771,1192499800,1307552511,1298785796,1281720306,1289958153,1316768798,1325007077,1341561107,1332794856,1246636998,1254647613,1271201483,1262662192,1239272743,1230733788,1213667370,1221678289,1562785183,1570797924,1554833554,1546300521,1588974462,1580441477,1597965939,1605978760,1518843046,1510078557,1527603627,1535847760,1494504007,1502748348,1486784330,1478020017,1390639894,1382365165,1399434779,1408230112,1366334967,1375129868,1358579962,1350304769,1430452783,1438955220,1422405410,1414423513,1456544974,1448562741,1465633219,1474135352];function h(e){for(let t=0;t<e.length;t++){if(!/^([^\s:]|[^\s:][^:]*[^\s:]): .+$/.test(e[t]))throw new Error("Improperly formatted armor header: "+e[t]);/^(Version|Comment|MessageID|Hash|Charset): .+$/.test(e[t])||o.default.print_debug_error(new Error("Unknown header: "+e[t]))}}function p(e){let t=e,r="";const n=e.lastIndexOf("=");return n>=0&&n!==e.length-1&&(t=e.slice(0,n),r=e.slice(n+1).substr(0,4)),{body:t,checksum:r}}r.default={encode:function(e,t,r,s,u){let c,l;e===a.default.armor.signed&&(c=t.text,l=t.hash,t=t.data);const h=n.default.passiveClone(t),p=[];switch(e){case a.default.armor.multipart_section:p.push("-----BEGIN PGP MESSAGE, PART "+r+"/"+s+"-----\r\n"),p.push(f(u)),p.push(i.default.encode(t)),p.push("\r\n=",d(h),"\r\n"),p.push("-----END PGP MESSAGE, PART "+r+"/"+s+"-----\r\n");break;case a.default.armor.multipart_last:p.push("-----BEGIN PGP MESSAGE, PART "+r+"-----\r\n"),p.push(f(u)),p.push(i.default.encode(t)),p.push("\r\n=",d(h),"\r\n"),p.push("-----END PGP MESSAGE, PART "+r+"-----\r\n");break;case a.default.armor.signed:p.push("\r\n-----BEGIN PGP SIGNED MESSAGE-----\r\n"),p.push("Hash: "+l+"\r\n\r\n"),p.push(c.replace(/^-/gm,"- -")),p.push("\r\n-----BEGIN PGP SIGNATURE-----\r\n"),p.push(f(u)),p.push(i.default.encode(t)),p.push("\r\n=",d(h),"\r\n"),p.push("-----END PGP SIGNATURE-----\r\n");break;case a.default.armor.message:p.push("-----BEGIN PGP MESSAGE-----\r\n"),p.push(f(u)),p.push(i.default.encode(t)),p.push("\r\n=",d(h),"\r\n"),p.push("-----END PGP MESSAGE-----\r\n");break;case a.default.armor.public_key:p.push("-----BEGIN PGP PUBLIC KEY BLOCK-----\r\n"),p.push(f(u)),p.push(i.default.encode(t)),p.push("\r\n=",d(h),"\r\n"),p.push("-----END PGP PUBLIC KEY BLOCK-----\r\n");break;case a.default.armor.private_key:p.push("-----BEGIN PGP PRIVATE KEY BLOCK-----\r\n"),p.push(f(u)),p.push(i.default.encode(t)),p.push("\r\n=",d(h),"\r\n"),p.push("-----END PGP PRIVATE KEY BLOCK-----\r\n");break;case a.default.armor.signature:p.push("-----BEGIN PGP SIGNATURE-----\r\n"),p.push(f(u)),p.push(i.default.encode(t)),p.push("\r\n=",d(h),"\r\n"),p.push("-----END PGP SIGNATURE-----\r\n")}return o.default.concat(p)},decode:function(e){return new Promise(async(t,r)=>{try{const u=/^-----[^-]+-----$/m,f=/^[ \f\r\t\u00a0\u2000-\u200a\u202f\u205f\u3000]*$/;let l;const y=[];let b,m,g,w=y,_=[],v=i.default.decode(n.default.transformPair(e,async(e,i)=>{const a=n.default.getReader(e);try{for(;;){let e=await a.readLine();if(void 0===e)throw new Error("Misformed armored text");if(e=o.default.removeTrailingSpaces(e.replace(/[\r\n]/g,"")),l)if(b)m||2!==l||(u.test(e)?(_=_.join("\r\n"),m=!0,h(w),w=[],b=!1):_.push(e.replace(/^- /,"")));else if(u.test(e)&&r(new Error("Mandatory blank line missing between armor headers and armor data")),f.test(e)){if(h(w),b=!0,m||2!==l){t({text:_,data:v,headers:y,type:l});break}}else w.push(e);else u.test(e)&&(l=c(e))}}catch(k){return void r(k)}const s=n.default.getWriter(i);try{for(;;){await s.ready;var d=await a.read();const e=d.done,t=d.value;if(e)throw new Error("Misformed armored text");const r=t+"";if(-1!==r.indexOf("=")||-1!==r.indexOf("-")){let e=await a.readToEnd();e.length||(e=""),e=r+e;const t=(e=o.default.removeTrailingSpaces(e.replace(/\r/g,""))).split(u);if(1===t.length)throw new Error("Misformed armored text");const n=p(t[0].slice(0,-1));g=n.checksum,await s.write(n.body);break}await s.write(r)}await s.ready,await s.close()}catch(k){await s.abort(k)}}));v=n.default.transformPair(v,async(e,t)=>{const r=d(n.default.passiveClone(e));await n.default.pipe(e,t,{preventClose:!0});const i=n.default.getWriter(t);try{const e=await n.default.readToEnd(r);if(g!==e&&(g||s.default.checksum_required))throw new Error("Ascii armor integrity check on message failed: '"+g+"' should be '"+e+"'");await i.ready,await i.close()}catch(a){await i.abort(a)}})}catch(a){r(a)}})}}},{"../config":81,"../enums.js":115,"../util":154,"./base64.js":114,"web-stream-tools":77}],114:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("web-stream-tools"),a=(n=i)&&n.__esModule?n:{default:n};const s="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",o="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";r.default={encode:function(e,t=!1){const r=t?o:s;let n,i,u=0,c=0;return a.default.transform(e,e=>{const a=[],s=e.length;for(let o=0;o<s;o++)u&&u%60==0&&!t&&a.push("\r\n"),i=e[o],0===c?(a.push(r.charAt(i>>2&63)),n=(3&i)<<4):1===c?(a.push(r.charAt(n|i>>4&15)),n=(15&i)<<2):2===c&&(a.push(r.charAt(n|i>>6&3)),(u+=1)%60!=0||t||a.push("\r\n"),a.push(r.charAt(63&i))),u+=1,3===(c+=1)&&(c=0);return a.join("")},()=>{const e=[];return c>0&&(e.push(r.charAt(n)),(u+=1)%60!=0||t||e.push("\r\n"),t||(e.push("="),u+=1)),1!==c||t||(u%60!=0||t||e.push("\r\n"),e.push("=")),e.join("")})},decode:function(e,t){const r=t?o:s;let n,i=0,u=0;return a.default.transform(e,e=>{const t=e.length,a=new Uint8Array(Math.ceil(.75*t));let s=0;for(let o=0;o<t;o++)(n=r.indexOf(e.charAt(o)))>=0&&(i&&(a[s++]=u|n>>6-i&255),u=n<<(i=i+2&7)&255);return a.subarray(0,s)})}}},{"web-stream-tools":77}],115:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});const n=Symbol("byValue");r.default={curve:{p256:"p256","P-256":"p256",secp256r1:"p256",prime256v1:"p256","1.2.840.10045.3.1.7":"p256","2a8648ce3d030107":"p256","2A8648CE3D030107":"p256",p384:"p384","P-384":"p384",secp384r1:"p384","1.3.132.0.34":"p384","2b81040022":"p384","2B81040022":"p384",p521:"p521","P-521":"p521",secp521r1:"p521","1.3.132.0.35":"p521","2b81040023":"p521","2B81040023":"p521",secp256k1:"secp256k1","1.3.132.0.10":"secp256k1","2b8104000a":"secp256k1","2B8104000A":"secp256k1",ED25519:"ed25519",ed25519:"ed25519",Ed25519:"ed25519","1.3.6.1.4.1.11591.15.1":"ed25519","2b06010401da470f01":"ed25519","2B06010401DA470F01":"ed25519",X25519:"curve25519",cv25519:"curve25519",curve25519:"curve25519",Curve25519:"curve25519","1.3.6.1.4.1.3029.1.5.1":"curve25519","2b060104019755010501":"curve25519","2B060104019755010501":"curve25519",brainpoolP256r1:"brainpoolP256r1","1.3.36.3.3.2.8.1.1.7":"brainpoolP256r1","2b2403030208010107":"brainpoolP256r1","2B2403030208010107":"brainpoolP256r1",brainpoolP384r1:"brainpoolP384r1","1.3.36.3.3.2.8.1.1.11":"brainpoolP384r1","2b240303020801010b":"brainpoolP384r1","2B240303020801010B":"brainpoolP384r1",brainpoolP512r1:"brainpoolP512r1","1.3.36.3.3.2.8.1.1.13":"brainpoolP512r1","2b240303020801010d":"brainpoolP512r1","2B240303020801010D":"brainpoolP512r1"},s2k:{simple:0,salted:1,iterated:3,gnu:101},publicKey:{rsa_encrypt_sign:1,rsa_encrypt:2,rsa_sign:3,elgamal:16,dsa:17,ecdh:18,ecdsa:19,eddsa:22,aedh:23,aedsa:24},symmetric:{plaintext:0,idea:1,"3des":2,tripledes:2,cast5:3,blowfish:4,aes128:7,aes192:8,aes256:9,twofish:10},compression:{uncompressed:0,zip:1,zlib:2,bzip2:3},hash:{md5:1,sha1:2,ripemd:3,sha256:8,sha384:9,sha512:10,sha224:11},webHash:{"SHA-1":2,"SHA-256":8,"SHA-384":9,"SHA-512":10},aead:{eax:1,ocb:2,experimental_gcm:100},packet:{publicKeyEncryptedSessionKey:1,signature:2,symEncryptedSessionKey:3,onePassSignature:4,secretKey:5,publicKey:6,secretSubkey:7,compressed:8,symmetricallyEncrypted:9,marker:10,literal:11,trust:12,userid:13,publicSubkey:14,userAttribute:17,symEncryptedIntegrityProtected:18,modificationDetectionCode:19,symEncryptedAEADProtected:20},literal:{binary:"b".charCodeAt(),text:"t".charCodeAt(),utf8:"u".charCodeAt(),mime:"m".charCodeAt()},signature:{binary:0,text:1,standalone:2,cert_generic:16,cert_persona:17,cert_casual:18,cert_positive:19,cert_revocation:48,subkey_binding:24,key_binding:25,key:31,key_revocation:32,subkey_revocation:40,timestamp:64,third_party:80},signatureSubpacket:{signature_creation_time:2,signature_expiration_time:3,exportable_certification:4,trust_signature:5,regular_expression:6,revocable:7,key_expiration_time:9,placeholder_backwards_compatibility:10,preferred_symmetric_algorithms:11,revocation_key:12,issuer:16,notation_data:20,preferred_hash_algorithms:21,preferred_compression_algorithms:22,key_server_preferences:23,preferred_key_server:24,primary_user_id:25,policy_uri:26,key_flags:27,signers_user_id:28,reason_for_revocation:29,features:30,signature_target:31,embedded_signature:32,issuer_fingerprint:33,preferred_aead_algorithms:34},keyFlags:{certify_keys:1,sign_data:2,encrypt_communication:4,encrypt_storage:8,split_private_key:16,authentication:32,shared_private_key:128},keyStatus:{invalid:0,expired:1,revoked:2,valid:3,no_self_cert:4},armor:{multipart_section:0,multipart_last:1,signed:2,message:3,public_key:4,private_key:5,signature:6},reasonForRevocation:{no_reason:0,key_superseded:1,key_compromised:2,key_retired:3,userid_invalid:32},features:{modification_detection:1,aead:2,v5_keys:4},write:function(e,t){if("number"==typeof t&&(t=this.read(e,t)),void 0!==e[t])return e[t];throw new Error("Invalid enum value.")},read:function(e,t){if(e[n]||(e[n]=[],Object.entries(e).forEach(([t,r])=>{e[n][r]=t})),void 0!==e[n][t])return e[n][t];throw new Error("Invalid enum value.")}}},{}],116:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("./config"),a=(n=i)&&n.__esModule?n:{default:n};function s(t){this._baseUrl=t||a.default.keyserver,this._fetch="undefined"!=typeof window?window.fetch:e("node-fetch")}s.prototype.lookup=function(e){let t=this._baseUrl+"/pks/lookup?op=get&options=mr&search=";const r=this._fetch;if(e.keyId)t+="0x"+encodeURIComponent(e.keyId);else{if(!e.query)throw new Error("You must provide a query parameter!");t+=encodeURIComponent(e.query)}return r(t).then(function(e){if(200===e.status)return e.text()}).then(function(e){if(e&&!(e.indexOf("-----END PGP PUBLIC KEY BLOCK-----")<0))return e.trim()})},s.prototype.upload=function(e){const t=this._baseUrl+"/pks/add";return(0,this._fetch)(t,{method:"post",headers:{"Content-Type":"application/x-www-form-urlencoded; charset=UTF-8"},body:"keytext="+encodeURIComponent(e)})},r.default=s},{"./config":81,"node-fetch":"node-fetch"}],117:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.WKD=r.HKP=r.AsyncProxy=r.Keyring=r.crypto=r.config=r.enums=r.armor=r.stream=r.OID=r.KDFParams=r.ECDHSymmetricKey=r.Keyid=r.S2K=r.MPI=r.packet=r.util=r.cleartext=r.message=r.signature=r.key=r.destroyWorker=r.getWorker=r.initWorker=r.decryptSessionKeys=r.encryptSessionKey=r.decryptKey=r.revokeKey=r.reformatKey=r.generateKey=r.verify=r.sign=r.decrypt=r.encrypt=void 0;var n=e("./openpgp");Object.defineProperty(r,"encrypt",{enumerable:!0,get:function(){return n.encrypt}}),Object.defineProperty(r,"decrypt",{enumerable:!0,get:function(){return n.decrypt}}),Object.defineProperty(r,"sign",{enumerable:!0,get:function(){return n.sign}}),Object.defineProperty(r,"verify",{enumerable:!0,get:function(){return n.verify}}),Object.defineProperty(r,"generateKey",{enumerable:!0,get:function(){return n.generateKey}}),Object.defineProperty(r,"reformatKey",{enumerable:!0,get:function(){return n.reformatKey}}),Object.defineProperty(r,"revokeKey",{enumerable:!0,get:function(){return n.revokeKey}}),Object.defineProperty(r,"decryptKey",{enumerable:!0,get:function(){return n.decryptKey}}),Object.defineProperty(r,"encryptSessionKey",{enumerable:!0,get:function(){return n.encryptSessionKey}}),Object.defineProperty(r,"decryptSessionKeys",{enumerable:!0,get:function(){return n.decryptSessionKeys}}),Object.defineProperty(r,"initWorker",{enumerable:!0,get:function(){return n.initWorker}}),Object.defineProperty(r,"getWorker",{enumerable:!0,get:function(){return n.getWorker}}),Object.defineProperty(r,"destroyWorker",{enumerable:!0,get:function(){return n.destroyWorker}});var i=e("./util");Object.defineProperty(r,"util",{enumerable:!0,get:function(){return x(i).default}});var a=e("./packet");Object.defineProperty(r,"packet",{enumerable:!0,get:function(){return x(a).default}});var s=e("./type/mpi");Object.defineProperty(r,"MPI",{enumerable:!0,get:function(){return x(s).default}});var o=e("./type/s2k");Object.defineProperty(r,"S2K",{enumerable:!0,get:function(){return x(o).default}});var u=e("./type/keyid");Object.defineProperty(r,"Keyid",{enumerable:!0,get:function(){return x(u).default}});var c=e("./type/ecdh_symkey");Object.defineProperty(r,"ECDHSymmetricKey",{enumerable:!0,get:function(){return x(c).default}});var f=e("./type/kdf_params");Object.defineProperty(r,"KDFParams",{enumerable:!0,get:function(){return x(f).default}});var d=e("./type/oid");Object.defineProperty(r,"OID",{enumerable:!0,get:function(){return x(d).default}});var l=e("web-stream-tools");Object.defineProperty(r,"stream",{enumerable:!0,get:function(){return x(l).default}});var h=e("./encoding/armor");Object.defineProperty(r,"armor",{enumerable:!0,get:function(){return x(h).default}});var p=e("./enums");Object.defineProperty(r,"enums",{enumerable:!0,get:function(){return x(p).default}});var y=e("./config/config");Object.defineProperty(r,"config",{enumerable:!0,get:function(){return x(y).default}});var b=e("./crypto");Object.defineProperty(r,"crypto",{enumerable:!0,get:function(){return x(b).default}});var m=e("./keyring");Object.defineProperty(r,"Keyring",{enumerable:!0,get:function(){return x(m).default}});var g=e("./worker/async_proxy");Object.defineProperty(r,"AsyncProxy",{enumerable:!0,get:function(){return x(g).default}});var w=e("./hkp");Object.defineProperty(r,"HKP",{enumerable:!0,get:function(){return x(w).default}});var _=e("./wkd");Object.defineProperty(r,"WKD",{enumerable:!0,get:function(){return x(_).default}});var v=P(n),k=P(e("./key")),A=P(e("./signature")),S=P(e("./message")),E=P(e("./cleartext"));function P(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t}function x(e){return e&&e.__esModule?e:{default:e}}r.default=v;r.key=k,r.signature=A,r.message=S,r.cleartext=E},{"./cleartext":79,"./config/config":80,"./crypto":96,"./encoding/armor":113,"./enums":115,"./hkp":116,"./key":118,"./keyring":119,"./message":122,"./openpgp":123,"./packet":127,"./signature":147,"./type/ecdh_symkey":148,"./type/kdf_params":149,"./type/keyid":150,"./type/mpi":151,"./type/oid":152,"./type/s2k":153,"./util":154,"./wkd":155,"./worker/async_proxy":156,"web-stream-tools":77}],118:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=function(){return function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var r=[],n=!0,i=!1,a=void 0;try{for(var s,o=e[Symbol.iterator]();!(n=(s=o.next()).done)&&(r.push(s.value),!t||r.length!==t);n=!0);}catch(u){i=!0,a=u}finally{try{!n&&o.return&&o.return()}finally{if(i)throw a}}return r}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}();r.Key=d,r.createSignaturePacket=y,r.read=m,r.readArmored=async function(e){try{const r=await i.default.decode(e);if(r.type!==u.default.armor.public_key&&r.type!==u.default.armor.private_key)throw new Error("Armored text not of type key");return m(r.data)}catch(t){const e={keys:[],err:[]};return e.err.push(t),e}},r.generate=async function(e){e.sign=!0,(e=r(e)).subkeys=e.subkeys.map(function(t,n){return r(e.subkeys[n],e)});let t=[async function(e){const t=new s.default.SecretKey(e.date);return t.packets=null,t.algorithm=u.default.read(u.default.publicKey,e.algorithm),await t.generate(e.numBits,e.curve),t}(e)];return t=t.concat(e.subkeys.map(async function(e){const t=new s.default.SecretSubkey(e.date);return t.packets=null,t.algorithm=u.default.read(u.default.publicKey,e.algorithm),await t.generate(e.numBits,e.curve),t})),Promise.all(t).then(t=>g(t[0],t.slice(1),e));function r(e,t={}){if(e.curve=e.curve||t.curve,e.numBits=e.numBits||t.numBits,e.keyExpirationTime=void 0!==e.keyExpirationTime?e.keyExpirationTime:t.keyExpirationTime,e.passphrase=c.default.isString(e.passphrase)?e.passphrase:t.passphrase,e.date=e.date||t.date,e.sign=e.sign||!1,e.curve){try{e.curve=u.default.write(u.default.curve,e.curve)}catch(r){throw new Error("Not valid curve.")}e.curve===u.default.curve.ed25519||e.curve===u.default.curve.curve25519?e.sign?(e.algorithm=u.default.publicKey.eddsa,e.curve=u.default.curve.ed25519):(e.algorithm=u.default.publicKey.ecdh,e.curve=u.default.curve.curve25519):e.sign?e.algorithm=u.default.publicKey.ecdsa:e.algorithm=u.default.publicKey.ecdh}else{if(!e.numBits)throw new Error("Unrecognized key type");e.algorithm=u.default.publicKey.rsa_encrypt_sign}return e}},r.reformat=async function(e){e=i(e);try{const t=e.privateKey.getKeys().every(e=>e.isDecrypted());t||await e.privateKey.decrypt()}catch(a){throw new Error("Key not decrypted")}const t=e.privateKey.toPacketlist();let r;const n=[];for(let s=0;s<t.length;s++)t[s].tag===u.default.packet.secretKey?r=t[s]:t[s].tag===u.default.packet.secretSubkey&&n.push(t[s]);if(!r)throw new Error("Key does not contain a secret key packet");e.subkeys||(e.subkeys=n.map(()=>({})));if(e.subkeys.length!==n.length)throw new Error("Number of subkey options does not match number of subkeys");return e.subkeys=e.subkeys.map(function(t,r){return i(e.subkeys[r],e)}),g(r,n,e);function i(e,t={}){return e.keyExpirationTime=e.keyExpirationTime||t.keyExpirationTime,e.passphrase=c.default.isString(e.passphrase)?e.passphrase:t.passphrase,e.date=e.date||t.date,e}},r.getPreferredHashAlgo=A,r.getPreferredAlgo=async function(e,t,r=new Date,n=[]){const i="symmetric"===e?"preferredSymmetricAlgorithms":"preferredAeadAlgorithms",a="symmetric"===e?u.default.symmetric.aes128:u.default.aead.eax,s={};await Promise.all(t.map(async function(e,t){const o=await e.getPrimaryUser(r,n[t]);if(!o||!o.selfCertification[i])return a;o.selfCertification[i].forEach(function(e,t){const r=s[e]||(s[e]={prio:0,count:0,algo:e});r.prio+=64>>t,r.count++})}));let o={prio:0,algo:a};return Object.values(s).forEach(({prio:r,count:n,algo:i})=>{try{i!==u.default[e].plaintext&&i!==u.default[e].idea&&u.default.read(u.default[e],i)&&n===t.length&&r>o.prio&&(o=s[i])}catch(a){}}),o.algo},r.isAeadSupported=async function(e,t=new Date,r=[]){let n=!0;return await Promise.all(e.map(async function(e,i){const a=await e.getPrimaryUser(t,r[i]);a&&a.selfCertification.features&&a.selfCertification.features[0]&u.default.features.aead||(n=!1)})),n};var i=f(e("./encoding/armor")),a=f(e("./crypto")),s=f(e("./packet")),o=f(e("./config")),u=f(e("./enums")),c=f(e("./util"));function f(e){return e&&e.__esModule?e:{default:e}}function d(e){if(!(this instanceof d))return new d(e);if(this.keyPacket=null,this.revocationSignatures=[],this.directSignatures=[],this.users=[],this.subKeys=[],this.packetlist2structure(e),!this.keyPacket||!this.users.length)throw new Error("Invalid key: need at least key and user ID packet")}async function l(e,t,r,n,i=new Date){let a;for(let s=e.length-1;s>=0;s--)a&&!(e[s].created>=a.created)||e[s].isExpired(i)||!e[s].verified&&!(await e[s].verify(t,r,n))||(a=e[s]);return a}async function h(e,t,r,n){(e=e[r])&&(t[r].length?await Promise.all(e.map(async function(e){e.isExpired()||n&&!(await n(e))||t[r].some(function(t){return c.default.equalsUint8Array(t.signature,e.signature)})||t[r].push(e)})):t[r]=e)}function p(e){if(!(this instanceof p))return new p(e);this.userId=e.tag===u.default.packet.userid?e:null,this.userAttribute=e.tag===u.default.packet.userAttribute?e:null,this.selfCertifications=[],this.otherCertifications=[],this.revocationSignatures=[]}async function y(e,t,r,n,i,a){if(!r.isDecrypted())throw new Error("Private key is not decrypted.");const o=new s.default.Signature(i);return Object.assign(o,n),o.publicKeyAlgorithm=r.algorithm,o.hashAlgorithm=await A(t,r,i,a),await o.sign(r,e),o}function b(e){if(!(this instanceof b))return new b(e);this.keyPacket=e,this.bindingSignatures=[],this.revocationSignatures=[]}async function m(e){const t={keys:[]},r=[];try{const i=new s.default.List;await i.read(e);const a=i.indexOfTag(u.default.packet.publicKey,u.default.packet.secretKey);if(0===a.length)throw new Error("No key packet found");for(let e=0;e<a.length;e++){const s=i.slice(a[e],a[e+1]);try{const e=new d(s);t.keys.push(e)}catch(n){r.push(n)}}}catch(n){r.push(n)}return r.length&&(t.err=r),t}async function g(e,t,r){r.passphrase&&await e.encrypt(r.passphrase),await Promise.all(t.map(async function(e,t){const n=r.subkeys[t].passphrase;n&&await e.encrypt(n)}));const n=new s.default.List;n.push(e),await Promise.all(r.userIds.map(async function(t,n){function i(e,t){if(t){const r=e.indexOf(t);r>=1&&e.splice(r,1),0!==r&&e.unshift(t)}return e}const a=new s.default.Userid;a.format(t);const c={};c.userId=a,c.key=e;const f=new s.default.Signature(r.date);return f.signatureType=u.default.signature.cert_generic,f.publicKeyAlgorithm=e.algorithm,f.hashAlgorithm=await A(null,e),f.keyFlags=[u.default.keyFlags.certify_keys|u.default.keyFlags.sign_data],f.preferredSymmetricAlgorithms=i([u.default.symmetric.aes256,u.default.symmetric.aes128,u.default.symmetric.aes192,u.default.symmetric.cast5,u.default.symmetric.tripledes],o.default.encryption_cipher),o.default.aead_protect&&4===o.default.aead_protect_version&&(f.preferredAeadAlgorithms=i([u.default.aead.eax,u.default.aead.ocb],o.default.aead_mode)),f.preferredHashAlgorithms=i([u.default.hash.sha256,u.default.hash.sha512,u.default.hash.sha1],o.default.prefer_hash_algorithm),f.preferredCompressionAlgorithms=i([u.default.compression.zlib,u.default.compression.zip],o.default.compression),0===n&&(f.isPrimaryUserID=!0),o.default.integrity_protect&&(f.features=[0],f.features[0]|=u.default.features.modification_detection),o.default.aead_protect&&4===o.default.aead_protect_version&&(f.features||(f.features=[0]),f.features[0]|=u.default.features.aead,f.features[0]|=u.default.features.v5_keys),r.keyExpirationTime>0&&(f.keyExpirationTime=r.keyExpirationTime,f.keyNeverExpires=!1),await f.sign(e,c),{userIdPacket:a,signaturePacket:f}})).then(e=>{e.forEach(({userIdPacket:e,signaturePacket:t})=>{n.push(e),n.push(t)})}),await Promise.all(t.map(async function(t,n){const i=r.subkeys[n],a={};a.key=e,a.bind=t;const o=new s.default.Signature(i.date);return o.signatureType=u.default.signature.subkey_binding,o.publicKeyAlgorithm=e.algorithm,o.hashAlgorithm=await A(null,t),i.sign?(o.keyFlags=[u.default.keyFlags.sign_data],o.embeddedSignature=await y(a,null,t,{signatureType:u.default.signature.key_binding},i.date)):o.keyFlags=[u.default.keyFlags.encrypt_communication|u.default.keyFlags.encrypt_storage],i.keyExpirationTime>0&&(o.keyExpirationTime=i.keyExpirationTime,o.keyNeverExpires=!1),await o.sign(e,a),{secretSubkeyPacket:t,subkeySignaturePacket:o}})).then(e=>{e.forEach(({secretSubkeyPacket:e,subkeySignaturePacket:t})=>{n.push(e),n.push(t)})});const i={key:e};return n.push(await y(i,null,e,{signatureType:u.default.signature.key_revocation,reasonForRevocationFlag:u.default.reasonForRevocation.no_reason,reasonForRevocationString:""},r.date)),r.passphrase&&e.clearPrivateParams(),await Promise.all(t.map(async function(e,t){r.subkeys[t].passphrase&&e.clearPrivateParams()})),new d(n)}async function w(e,t,r,n,i,a,s=new Date){a=a||e;const u=c.default.normalizeDate(s),f=[];return await Promise.all(n.map(async function(e){return!(i&&!e.issuerKeyId.equals(i.issuerKeyId)||o.default.revocations_expire&&e.isExpired(u)||!e.verified&&!(await e.verify(a,t,r)))&&(f.push(e.issuerKeyId),!0)})),i?(i.revoked=!!f.some(e=>e.equals(i.issuerKeyId))||(i.revoked||!1),i.revoked):f.length>0}function _(e,t,r=new Date){const n=c.default.normalizeDate(r);if(null!==n){const i=v(e,t);return!(e.created<=n&&n<=i)||t&&t.isExpired(r)}return!1}function v(e,t){let r;return!1===t.keyNeverExpires&&(r=e.created.getTime()+1e3*t.keyExpirationTime),r?new Date(r):1/0}function k(e,t){if(null!==e.revocationKeyClass&&e.issuerKeyId.equals(t))throw new Error("This key is intended to be revoked with an authorized key, which OpenPGP.js does not support.")}async function A(e,t,r=new Date,i={}){let u=o.default.prefer_hash_algorithm,c=u;if(e instanceof d){const t=await e.getPrimaryUser(r,i);if(t&&t.selfCertification.preferredHashAlgorithms)c=n(t.selfCertification.preferredHashAlgorithms,1)[0],u=a.default.hash.getHashByteLength(u)<=a.default.hash.getHashByteLength(c)?c:u}switch(Object.getPrototypeOf(t)){case s.default.SecretKey.prototype:case s.default.PublicKey.prototype:case s.default.SecretSubkey.prototype:case s.default.PublicSubkey.prototype:switch(t.algorithm){case"ecdh":case"ecdsa":case"eddsa":c=a.default.publicKey.elliptic.getPreferredHashAlgo(t.params[0])}}return a.default.hash.getHashByteLength(u)<=a.default.hash.getHashByteLength(c)?c:u}Object.defineProperty(d.prototype,"primaryKey",{get(){return this.keyPacket},configurable:!0,enumerable:!0}),d.prototype.packetlist2structure=function(e){let t,r,n;for(let i=0;i<e.length;i++)switch(e[i].tag){case u.default.packet.publicKey:case u.default.packet.secretKey:this.keyPacket=e[i],r=this.getKeyId();break;case u.default.packet.userid:case u.default.packet.userAttribute:t=new p(e[i]),this.users.push(t);break;case u.default.packet.publicSubkey:case u.default.packet.secretSubkey:t=null,n=new b(e[i]),this.subKeys.push(n);break;case u.default.packet.signature:switch(e[i].signatureType){case u.default.signature.cert_generic:case u.default.signature.cert_persona:case u.default.signature.cert_casual:case u.default.signature.cert_positive:if(!t){c.default.print_debug("Dropping certification signatures without preceding user packet");continue}e[i].issuerKeyId.equals(r)?(k(e[i],r),t.selfCertifications.push(e[i])):t.otherCertifications.push(e[i]);break;case u.default.signature.cert_revocation:t?t.revocationSignatures.push(e[i]):this.directSignatures.push(e[i]);break;case u.default.signature.key:k(e[i],r),this.directSignatures.push(e[i]);break;case u.default.signature.subkey_binding:if(!n){c.default.print_debug("Dropping subkey binding signature without preceding subkey packet");continue}k(e[i],r),n.bindingSignatures.push(e[i]);break;case u.default.signature.key_revocation:this.revocationSignatures.push(e[i]);break;case u.default.signature.subkey_revocation:if(!n){c.default.print_debug("Dropping subkey revocation signature without preceding subkey packet");continue}n.revocationSignatures.push(e[i])}}},d.prototype.toPacketlist=function(){const e=new s.default.List;return e.push(this.keyPacket),e.concat(this.revocationSignatures),e.concat(this.directSignatures),this.users.map(t=>e.concat(t.toPacketlist())),this.subKeys.map(t=>e.concat(t.toPacketlist())),e},d.prototype.getSubkeys=function(e=null){const t=[];return this.subKeys.forEach(r=>{e&&!r.getKeyId().equals(e,!0)||t.push(r)}),t},d.prototype.getKeys=function(e=null){const t=[];return e&&!this.getKeyId().equals(e,!0)||t.push(this),t.concat(this.getSubkeys(e))},d.prototype.getKeyIds=function(){return this.getKeys().map(e=>e.getKeyId())},d.prototype.getUserIds=function(){return this.users.map(e=>e.userId?e.userId.userid:null).filter(e=>null!==e)},d.prototype.isPublic=function(){return this.keyPacket.tag===u.default.packet.publicKey},d.prototype.isPrivate=function(){return this.keyPacket.tag===u.default.packet.secretKey},d.prototype.toPublic=function(){const e=new s.default.List,t=this.toPacketlist();let r,n,i;for(let a=0;a<t.length;a++)switch(t[a].tag){case u.default.packet.secretKey:r=t[a].writePublicKey(),(n=new s.default.PublicKey).read(r),e.push(n);break;case u.default.packet.secretSubkey:r=t[a].writePublicKey(),(i=new s.default.PublicSubkey).read(r),e.push(i);break;default:e.push(t[a])}return new d(e)},d.prototype.armor=function(){const e=this.isPublic()?u.default.armor.public_key:u.default.armor.private_key;return i.default.encode(e,this.toPacketlist().write())},d.prototype.getSigningKey=async function(e=null,t=new Date,r={}){const n=this.keyPacket;if(await this.verifyPrimaryKey(t,r)===u.default.keyStatus.valid){const a=this.subKeys.slice().sort((e,t)=>t.keyPacket.created-e.keyPacket.created);for(let r=0;r<a.length;r++)if((!e||a[r].getKeyId().equals(e))&&await a[r].verify(n,t)===u.default.keyStatus.valid){const e={key:n,bind:a[r].keyPacket},s=await l(a[r].bindingSignatures,n,u.default.signature.subkey_binding,e,t);if(s&&s.embeddedSignature&&i(a[r].keyPacket,s)&&await l([s.embeddedSignature],a[r].keyPacket,u.default.signature.key_binding,e,t))return a[r]}const s=await this.getPrimaryUser(t,r);if(s&&(!e||n.getKeyId().equals(e))&&i(n,s.selfCertification))return this}return null;function i(e,t){if(!t.verified||!1!==t.revoked)throw new Error("Signature not verified");return e.algorithm!==u.default.read(u.default.publicKey,u.default.publicKey.rsa_encrypt)&&e.algorithm!==u.default.read(u.default.publicKey,u.default.publicKey.elgamal)&&e.algorithm!==u.default.read(u.default.publicKey,u.default.publicKey.ecdh)&&(!t.keyFlags||0!=(t.keyFlags[0]&u.default.keyFlags.sign_data))}},d.prototype.getEncryptionKey=async function(e,t=new Date,r={}){const n=this.keyPacket;if(await this.verifyPrimaryKey(t,r)===u.default.keyStatus.valid){const a=this.subKeys.slice().sort((e,t)=>t.keyPacket.created-e.keyPacket.created);for(let r=0;r<a.length;r++)if((!e||a[r].getKeyId().equals(e))&&await a[r].verify(n,t)===u.default.keyStatus.valid){const e={key:n,bind:a[r].keyPacket},s=await l(a[r].bindingSignatures,n,u.default.signature.subkey_binding,e,t);if(s&&i(a[r].keyPacket,s))return a[r]}const s=await this.getPrimaryUser(t,r);if(s&&(!e||n.getKeyId().equals(e))&&i(n,s.selfCertification))return this}return null;function i(e,t){if(!t.verified||!1!==t.revoked)throw new Error("Signature not verified");return e.algorithm!==u.default.read(u.default.publicKey,u.default.publicKey.dsa)&&e.algorithm!==u.default.read(u.default.publicKey,u.default.publicKey.rsa_sign)&&e.algorithm!==u.default.read(u.default.publicKey,u.default.publicKey.ecdsa)&&e.algorithm!==u.default.read(u.default.publicKey,u.default.publicKey.eddsa)&&(!t.keyFlags||0!=(t.keyFlags[0]&u.default.keyFlags.encrypt_communication)||0!=(t.keyFlags[0]&u.default.keyFlags.encrypt_storage))}},d.prototype.encrypt=async function(e,t=null){if(!this.isPrivate())throw new Error("Nothing to encrypt in a public key");const r=this.getKeys(t);if((e=c.default.isArray(e)?e:new Array(r.length).fill(e)).length!==r.length)throw new Error("Invalid number of passphrases for key");return Promise.all(r.map(async function(t,r){const n=t.keyPacket;return await n.encrypt(e[r]),n.clearPrivateParams(),n}))},d.prototype.decrypt=async function(e,t=null){if(!this.isPrivate())throw new Error("Nothing to decrypt in a public key");return e=c.default.isArray(e)?e:[e],(await Promise.all(this.getKeys(t).map(async function(t){let r=!1,n=null;if(await Promise.all(e.map(async function(e){try{await t.keyPacket.decrypt(e),r=!0}catch(i){n=i}})),!r)throw n;return r}))).every(e=>!0===e)},d.prototype.isRevoked=async function(e,t,r=new Date){return w(this.keyPacket,u.default.signature.key_revocation,{key:this.keyPacket},this.revocationSignatures,e,t,r)},d.prototype.verifyPrimaryKey=async function(e=new Date,t={}){const r=this.keyPacket;if(await this.isRevoked(null,null,e))return u.default.keyStatus.revoked;if(!this.users.some(e=>e.userId&&e.selfCertifications.length))return u.default.keyStatus.no_self_cert;var n=await this.getPrimaryUser(e,t)||{};const i=n.user,a=n.selfCertification;return i?_(r,a,e)?u.default.keyStatus.expired:u.default.keyStatus.valid:u.default.keyStatus.invalid},d.prototype.getExpirationTime=async function(e,t,r){const n=await this.getPrimaryUser(null,r);if(!n)throw new Error("Could not find primary user");const i=n.selfCertification,a=v(this.keyPacket,i),s=i.getExpirationTime();let o=a<s?a:s;if("encrypt"===e||"encrypt_sign"===e){const e=await this.getEncryptionKey(t,o,r)||await this.getEncryptionKey(t,null,r);if(!e)return null;const n=await e.getExpirationTime(this.keyPacket);n<o&&(o=n)}if("sign"===e||"encrypt_sign"===e){const e=await this.getSigningKey(t,o,r)||await this.getSigningKey(t,null,r);if(!e)return null;const n=await e.getExpirationTime(this.keyPacket);n<o&&(o=n)}return o},d.prototype.getPrimaryUser=async function(e=new Date,t={}){const r=this.keyPacket,n=[];for(let o=0;o<this.users.length;o++){const i=this.users[o];if(!i.userId||void 0!==t.name&&i.userId.name!==t.name||void 0!==t.email&&i.userId.email!==t.email||void 0!==t.comment&&i.userId.comment!==t.comment)continue;const a={userId:i.userId,key:r},s=await l(i.selfCertifications,r,u.default.signature.cert_generic,a,e);s&&n.push({index:o,user:i,selfCertification:s})}if(!n.length){if(void 0!==t.name||void 0!==t.email||void 0!==t.comment)throw new Error("Could not find user that matches that user ID");return null}await Promise.all(n.map(async function(t){return t.user.revoked||t.user.isRevoked(r,t.selfCertification,null,e)}));const i=n.sort(function(e,t){const r=e.selfCertification,n=t.selfCertification;return n.revoked-r.revoked||r.isPrimaryUserID-n.isPrimaryUserID||r.created-n.created}).pop(),a=i.user,s=i.selfCertification;return s.revoked||await a.isRevoked(r,s,null,e)?null:i},d.prototype.update=async function(e){if(await e.verifyPrimaryKey()!==u.default.keyStatus.invalid){if(!this.hasSameFingerprintAs(e))throw new Error("Key update method: fingerprints of keys not equal");if(this.isPublic()&&e.isPrivate()){if(!(this.subKeys.length===e.subKeys.length&&this.subKeys.every(t=>e.subKeys.some(e=>t.hasSameFingerprintAs(e)))))throw new Error("Cannot update public key with private key if subkey mismatch");this.keyPacket=e.keyPacket}await h(e,this,"revocationSignatures",t=>w(this.keyPacket,u.default.signature.key_revocation,this,[t],null,e.keyPacket)),await h(e,this,"directSignatures"),await Promise.all(e.users.map(async e=>{let t=!1;await Promise.all(this.users.map(async r=>{(e.userId&&r.userId&&e.userId.userid===r.userId.userid||e.userAttribute&&e.userAttribute.equals(r.userAttribute))&&(await r.update(e,this.keyPacket),t=!0)})),t||this.users.push(e)})),await Promise.all(e.subKeys.map(async e=>{let t=!1;await Promise.all(this.subKeys.map(async r=>{r.hasSameFingerprintAs(e)&&(await r.update(e,this.keyPacket),t=!0)})),t||this.subKeys.push(e)}))}},d.prototype.revoke=async function({flag:e=u.default.reasonForRevocation.no_reason,string:t=""}={},r=new Date){if(this.isPublic())throw new Error("Need private key for revoking");const n={key:this.keyPacket},i=new d(this.toPacketlist());return i.revocationSignatures.push(await y(n,null,this.keyPacket,{signatureType:u.default.signature.key_revocation,reasonForRevocationFlag:u.default.write(u.default.reasonForRevocation,e),reasonForRevocationString:t},r)),i},d.prototype.getRevocationCertificate=async function(){const e={key:this.keyPacket},t=await l(this.revocationSignatures,this.keyPacket,u.default.signature.key_revocation,e);if(t){const e=new s.default.List;return e.push(t),i.default.encode(u.default.armor.public_key,e.write(),null,null,"This is a revocation certificate")}},d.prototype.applyRevocationCertificate=async function(e){const t=await i.default.decode(e),r=new s.default.List;await r.read(t.data);const n=r.findPacket(u.default.packet.signature);if(!n||n.signatureType!==u.default.signature.key_revocation)throw new Error("Could not find revocation signature packet");if(!n.issuerKeyId.equals(this.getKeyId()))throw new Error("Revocation signature does not match key");if(n.isExpired())throw new Error("Revocation signature is expired");if(!(await n.verify(this.keyPacket,u.default.signature.key_revocation,{key:this.keyPacket})))throw new Error("Could not verify revocation signature");const a=new d(this.toPacketlist());return a.revocationSignatures.push(n),a},d.prototype.signPrimaryUser=async function(e,t,r){var n=await this.getPrimaryUser(t,r)||{};const i=n.index,a=n.user;if(!a)throw new Error("Could not find primary user");const s=await a.sign(this.keyPacket,e),o=new d(this.toPacketlist());return o.users[i]=s,o},d.prototype.signAllUsers=async function(e){const t=this,r=new d(this.toPacketlist());return r.users=await Promise.all(this.users.map(function(r){return r.sign(t.keyPacket,e)})),r},d.prototype.verifyPrimaryUser=async function(e,t,r){const n=this.keyPacket;const i=(await this.getPrimaryUser(t,r)||{}).user;if(!i)throw new Error("Could not find primary user");return e?await i.verifyAllCertifications(n,e):[{keyid:n.keyid,valid:await i.verify(n)===u.default.keyStatus.valid}]},d.prototype.verifyAllUsers=async function(e){const t=[],r=this.keyPacket;return await Promise.all(this.users.map(async function(n){(e?await n.verifyAllCertifications(r,e):[{keyid:r.keyid,valid:await n.verify(r)===u.default.keyStatus.valid}]).forEach(e=>{t.push({userid:n.userId.userid,keyid:e.keyid,valid:e.valid})})})),t},p.prototype.toPacketlist=function(){const e=new s.default.List;return e.push(this.userId||this.userAttribute),e.concat(this.revocationSignatures),e.concat(this.selfCertifications),e.concat(this.otherCertifications),e},p.prototype.sign=async function(e,t){const r={userId:this.userId,userAttribute:this.userAttribute,key:e},n=new p(r.userId||r.userAttribute);return n.otherCertifications=await Promise.all(t.map(async function(t){if(t.isPublic())throw new Error("Need private key for signing");if(t.hasSameFingerprintAs(e))throw new Error("Not implemented for self signing");const n=await t.getSigningKey();if(!n)throw new Error("Could not find valid signing key packet in key "+t.getKeyId().toHex());return y(r,t,n.keyPacket,{signatureType:u.default.signature.cert_generic,keyFlags:[u.default.keyFlags.certify_keys|u.default.keyFlags.sign_data]})})),await n.update(this,e),n},p.prototype.isRevoked=async function(e,t,r,n=new Date){return w(e,u.default.signature.cert_revocation,{key:e,userId:this.userId,userAttribute:this.userAttribute},this.revocationSignatures,t,r,n)},p.prototype.verifyCertificate=async function(e,t,r,n=new Date){const i=this,a=t.issuerKeyId,s={userId:this.userId,userAttribute:this.userAttribute,key:e};return(await Promise.all(r.map(async function(r){if(!r.getKeyIds().some(e=>e.equals(a)))return;const o=await r.getSigningKey(a,n);return t.revoked||await i.isRevoked(e,t,o.keyPacket)?u.default.keyStatus.revoked:t.verified||await t.verify(o.keyPacket,u.default.signature.cert_generic,s)?t.isExpired()?u.default.keyStatus.expired:u.default.keyStatus.valid:u.default.keyStatus.invalid}))).find(e=>void 0!==e)},p.prototype.verifyAllCertifications=async function(e,t){const r=this,n=this.selfCertifications.concat(this.otherCertifications);return Promise.all(n.map(async function(n){const i=await r.verifyCertificate(e,n,t);return{keyid:n.issuerKeyId,valid:void 0===i?null:i===u.default.keyStatus.valid}}))},p.prototype.verify=async function(e){if(!this.selfCertifications.length)return u.default.keyStatus.no_self_cert;const t=this,r={userId:this.userId,userAttribute:this.userAttribute,key:e},n=[u.default.keyStatus.invalid].concat(await Promise.all(this.selfCertifications.map(async function(n){return n.revoked||await t.isRevoked(e,n)?u.default.keyStatus.revoked:n.verified||await n.verify(e,u.default.signature.cert_generic,r)?n.isExpired()?u.default.keyStatus.expired:u.default.keyStatus.valid:u.default.keyStatus.invalid})));return n.some(e=>e===u.default.keyStatus.valid)?u.default.keyStatus.valid:n.pop()},p.prototype.update=async function(e,t){const r={userId:this.userId,userAttribute:this.userAttribute,key:t};await h(e,this,"selfCertifications",async function(e){return e.verified||e.verify(t,u.default.signature.cert_generic,r)}),await h(e,this,"otherCertifications"),await h(e,this,"revocationSignatures",function(e){return w(t,u.default.signature.cert_revocation,r,[e])})},b.prototype.toPacketlist=function(){const e=new s.default.List;return e.push(this.keyPacket),e.concat(this.revocationSignatures),e.concat(this.bindingSignatures),e},b.prototype.isRevoked=async function(e,t,r,n=new Date){return w(e,u.default.signature.subkey_revocation,{key:e,bind:this.keyPacket},this.revocationSignatures,t,r,n)},b.prototype.verify=async function(e,t=new Date){const r={key:e,bind:this.keyPacket},n=await l(this.bindingSignatures,e,u.default.signature.subkey_binding,r,t);return n?n.revoked||await this.isRevoked(e,n,null,t)?u.default.keyStatus.revoked:_(this.keyPacket,n,t)?u.default.keyStatus.expired:u.default.keyStatus.valid:u.default.keyStatus.invalid},b.prototype.getExpirationTime=async function(e,t=new Date){const r={key:e,bind:this.keyPacket},n=await l(this.bindingSignatures,e,u.default.signature.subkey_binding,r,t);if(!n)return null;const i=v(this.keyPacket,n),a=n.getExpirationTime();return i<a?i:a},b.prototype.update=async function(e,t){if(await e.verify(t)===u.default.keyStatus.invalid)return;if(!this.hasSameFingerprintAs(e))throw new Error("SubKey update method: fingerprints of subkeys not equal");this.keyPacket.tag===u.default.packet.publicSubkey&&e.keyPacket.tag===u.default.packet.secretSubkey&&(this.keyPacket=e.keyPacket);const r=this,n={key:t,bind:r.keyPacket};await h(e,this,"bindingSignatures",async function(e){if(!e.verified&&!(await e.verify(t,u.default.signature.subkey_binding,n)))return!1;for(let t=0;t<r.bindingSignatures.length;t++)if(r.bindingSignatures[t].issuerKeyId.equals(e.issuerKeyId)&&e.created<r.bindingSignatures[t].created)return r.bindingSignatures[t]=e,!1;return!0}),await h(e,this,"revocationSignatures",function(e){return w(t,u.default.signature.subkey_revocation,n,[e])})},b.prototype.revoke=async function(e,{flag:t=u.default.reasonForRevocation.no_reason,string:r=""}={},n=new Date){const i={key:e,bind:this.keyPacket},a=new b(this.keyPacket);return a.revocationSignatures.push(await y(i,null,e,{signatureType:u.default.signature.subkey_revocation,reasonForRevocationFlag:u.default.write(u.default.reasonForRevocation,t),reasonForRevocationString:r},n)),await a.update(this,e),a},["getKeyId","getFingerprint","getAlgorithmInfo","getCreationTime","isDecrypted"].forEach(e=>{d.prototype[e]=b.prototype[e]=function(){return this.keyPacket[e]()}}),d.prototype.hasSameFingerprintAs=b.prototype.hasSameFingerprintAs=function(e){return this.keyPacket.hasSameFingerprintAs(e.keyPacket||e)}},{"./config":81,"./crypto":96,"./encoding/armor":113,"./enums":115,"./packet":127,"./util":154}],119:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("./keyring.js")),i=a(e("./localstore.js"));function a(e){return e&&e.__esModule?e:{default:e}}n.default.localstore=i.default,r.default=n.default},{"./keyring.js":120,"./localstore.js":121}],120:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../key"),a=e("./localstore"),s=(n=a)&&n.__esModule?n:{default:n};function o(e){this.storeHandler=e||new s.default}function u(e){this.keys=e}function c(e,t){const r=(e=e.toLowerCase()).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),n=new RegExp("<"+r+">"),i=t.getUserIds();for(let a=0;a<i.length;a++){const t=i[a].toLowerCase();if(e===t||n.test(t))return!0}return!1}function f(e,t){return 16===e.length?e===t.getKeyId().toHex():e===t.getFingerprint()}o.prototype.load=async function(){this.publicKeys=new u(await this.storeHandler.loadPublic()),this.privateKeys=new u(await this.storeHandler.loadPrivate())},o.prototype.store=async function(){await Promise.all([this.storeHandler.storePublic(this.publicKeys.keys),this.storeHandler.storePrivate(this.privateKeys.keys)])},o.prototype.clear=function(){this.publicKeys.keys=[],this.privateKeys.keys=[]},o.prototype.getKeysForId=function(e,t){let r=[];return(r=(r=r.concat(this.publicKeys.getForId(e,t)||[])).concat(this.privateKeys.getForId(e,t)||[])).length?r:null},o.prototype.removeKeysForId=function(e){let t=[];return(t=(t=t.concat(this.publicKeys.removeForId(e)||[])).concat(this.privateKeys.removeForId(e)||[])).length?t:null},o.prototype.getAllKeys=function(){return this.publicKeys.keys.concat(this.privateKeys.keys)},u.prototype.getForAddress=function(e){const t=[];for(let r=0;r<this.keys.length;r++)c(e,this.keys[r])&&t.push(this.keys[r]);return t},u.prototype.getForId=function(e,t){for(let r=0;r<this.keys.length;r++){if(f(e,this.keys[r]))return this.keys[r];if(t&&this.keys[r].subKeys.length)for(let t=0;t<this.keys[r].subKeys.length;t++)if(f(e,this.keys[r].subKeys[t]))return this.keys[r]}return null},u.prototype.importKey=async function(e){const t=await(0,i.readArmored)(e);for(let r=0;r<t.keys.length;r++){const e=t.keys[r],n=e.getKeyId().toHex(),i=this.getForId(n);i?await i.update(e):this.push(e)}return t.err?t.err:null},u.prototype.push=function(e){return this.keys.push(e)},u.prototype.removeForId=function(e){for(let t=0;t<this.keys.length;t++)if(f(e,this.keys[t]))return this.keys.splice(t,1)[0];return null},r.default=o},{"../key":118,"./localstore":121}],121:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=o(e("web-stream-tools")),i=o(e("../config")),a=e("../key"),s=o(e("../util"));function o(e){return e&&e.__esModule?e:{default:e}}function u(t){t=t||"openpgp-",this.publicKeysItem=t+this.publicKeysItem,this.privateKeysItem=t+this.privateKeysItem,"undefined"!=typeof window&&window.localStorage?this.storage=window.localStorage:this.storage=new(e("node-localstorage").LocalStorage)(i.default.node_store)}async function c(e,t){const r=JSON.parse(e.getItem(t)),n=[];if(null!==r&&0!==r.length){let e;for(let t=0;t<r.length;t++)(e=await(0,a.readArmored)(r[t])).err?s.default.print_debug("Error reading armored key from keyring index: "+t):n.push(e.keys[0])}return n}async function f(e,t,r){if(r.length){const i=await Promise.all(r.map(e=>n.default.readToEnd(e.armor())));e.setItem(t,JSON.stringify(i))}else e.removeItem(t)}u.prototype.publicKeysItem="public-keys",u.prototype.privateKeysItem="private-keys",u.prototype.loadPublic=async function(){return c(this.storage,this.publicKeysItem)},u.prototype.loadPrivate=async function(){return c(this.storage,this.privateKeysItem)},u.prototype.storePublic=async function(e){await f(this.storage,this.publicKeysItem,e)},u.prototype.storePrivate=async function(e){await f(this.storage,this.privateKeysItem,e)},r.default=u},{"../config":81,"../key":118,"../util":154,"node-localstorage":"node-localstorage","web-stream-tools":77}],122:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.Message=p,r.encryptSessionKey=y,r.createSignaturePackets=b,r.createVerificationObjects=m,r.readArmored=async function(e){const t=c.default.isStream(e);"node"===t&&(e=n.default.nodeToWeb(e));return g((await i.default.decode(e)).data,t)},r.read=g,r.fromText=function(e,t,r=new Date,i="utf8"){const a=c.default.isStream(e);"node"===a&&(e=n.default.nodeToWeb(e));const s=new f.default.Literal(r);s.setText(e,i),void 0!==t&&s.setFilename(t);const o=new f.default.List;o.push(s);const u=new p(o);return u.fromStream=a,u},r.fromBinary=function(e,t,r=new Date,i="binary"){const a=c.default.isStream(e);if(!c.default.isUint8Array(e)&&!a)throw new Error("Data must be in the form of a Uint8Array or Stream");"node"===a&&(e=n.default.nodeToWeb(e));const s=new f.default.Literal(r);s.setBytes(e,i),void 0!==t&&s.setFilename(t);const o=new f.default.List;o.push(s);const u=new p(o);return u.fromStream=a,u};var n=h(e("web-stream-tools")),i=h(e("./encoding/armor")),a=h(e("./type/keyid")),s=h(e("./config")),o=h(e("./crypto")),u=h(e("./enums")),c=h(e("./util")),f=h(e("./packet")),d=e("./signature"),l=e("./key");function h(e){return e&&e.__esModule?e:{default:e}}function p(e){if(!(this instanceof p))return new p(e);this.packets=e||new f.default.List}async function y(e,t,r,n,i,o=!1,u=new Date,c=[]){const d=new f.default.List;if(n){const r=await Promise.all(n.map(async function(r){const n=await r.getEncryptionKey(void 0,u,c);if(!n)throw new Error("Could not find valid key packet for encryption in key "+r.getKeyId().toHex());const i=new f.default.PublicKeyEncryptedSessionKey;return i.publicKeyId=o?a.default.wildcard():n.getKeyId(),i.publicKeyAlgorithm=n.keyPacket.algorithm,i.sessionKey=e,i.sessionKeyAlgorithm=t,await i.encrypt(n.keyPacket),delete i.sessionKey,i}));d.concat(r)}if(i){const n=async function(e,t){try{return await e.decrypt(t),1}catch(r){return 0}},a=(e,t)=>e+t,o=async function e(t,r,o,u){const c=new f.default.SymEncryptedSessionKey;if(c.sessionKey=t,c.sessionKeyAlgorithm=r,o&&(c.aeadAlgorithm=o),await c.encrypt(u),s.default.password_collision_check){if(1!==(await Promise.all(i.map(e=>n(c,e)))).reduce(a))return e(t,r,u)}return delete c.sessionKey,c},u=await Promise.all(i.map(n=>o(e,t,r,n)));d.concat(u)}return new p(d)}async function b(e,t,r=null,n=new Date,i=[]){const a=new f.default.List,s=null===e.text?u.default.signature.binary:u.default.signature.text;if(await Promise.all(t.map(async(t,r)=>{const a=i[r];if(t.isPublic())throw new Error("Need private key for signing");const o=await t.getSigningKey(void 0,n,a);if(!o)throw new Error(`Could not find valid signing key packet in key ${t.getKeyId().toHex()}`);return(0,l.createSignaturePacket)(e,t,o.keyPacket,{signatureType:s},n,a)})).then(e=>{e.forEach(e=>a.push(e))}),r){const e=r.packets.filterByTag(u.default.packet.signature);a.concat(e)}return a}async function m(e,t,r,n=new Date){return Promise.all(e.filter(function(e){return["text","binary"].includes(u.default.read(u.default.signature,e.signatureType))}).map(async function(e){return async function(e,t,r,n=new Date){let i=null,a=null;await Promise.all(r.map(async function(t){const r=await t.getSigningKey(e.issuerKeyId,null);r&&(i=t,a=r)}));const s=e.correspondingSig||e,o={keyid:e.issuerKeyId,verified:(async()=>{if(!a)return null;const r=await e.verify(a.keyPacket,e.signatureType,t[0]),o=await s;return o.isExpired(n)||!(o.created>=a.getCreationTime()&&o.created<await(a===i?a.getExpirationTime():a.getExpirationTime(i,n)))?null:r})(),signature:(async()=>{const e=await s,t=new f.default.List;return t.push(e),new d.Signature(t)})()};return o.signature.catch(()=>{}),o.verified.catch(()=>{}),o}(e,t,r,n)}))}async function g(e,t=c.default.isStream(e)){"node"===c.default.isStream(e)&&(e=n.default.nodeToWeb(e));const r=new f.default.List;await r.read(e);const i=new p(r);return i.fromStream=t,i}p.prototype.getEncryptionKeyIds=function(){const e=[];return this.packets.filterByTag(u.default.packet.publicKeyEncryptedSessionKey).forEach(function(t){e.push(t.publicKeyId)}),e},p.prototype.getSigningKeyIds=function(){const e=[],t=this.unwrapCompressed();if(t.packets.filterByTag(u.default.packet.onePassSignature).forEach(function(t){e.push(t.issuerKeyId)}),!e.length){t.packets.filterByTag(u.default.packet.signature).forEach(function(t){e.push(t.issuerKeyId)})}return e},p.prototype.decrypt=async function(e,t,r,i){const a=r||await this.decryptSessionKeys(e,t),s=this.packets.filterByTag(u.default.packet.symmetricallyEncrypted,u.default.packet.symEncryptedIntegrityProtected,u.default.packet.symEncryptedAEADProtected);if(0===s.length)return this;const o=s[0];let d=null;for(let n=0;n<a.length;n++){if(!a[n]||!c.default.isUint8Array(a[n].data)||!c.default.isString(a[n].algorithm))throw new Error("Invalid session key for decryption.");try{await o.decrypt(a[n].algorithm,a[n].data,i);break}catch(h){c.default.print_debug_error(h),d=h}}if(n.default.cancel(o.encrypted),o.encrypted=null,!o.packets||!o.packets.length)throw d||new Error("Decryption failed.");const l=new p(o.packets);return o.packets=new f.default.List,l},p.prototype.decryptSessionKeys=async function(e,t){let r,i=[];if(t){const e=this.packets.filterByTag(u.default.packet.symEncryptedSessionKey);if(!e)throw new Error("No symmetrically encrypted session key packet found.");await Promise.all(t.map(async function(t,r){let n;r?(n=new f.default.List,await n.read(e.write())):n=e,await Promise.all(n.map(async function(e){try{await e.decrypt(t),i.push(e)}catch(r){c.default.print_debug_error(r)}}))}))}else{if(!e)throw new Error("No key or password specified.");{const t=this.packets.filterByTag(u.default.packet.publicKeyEncryptedSessionKey);if(!t)throw new Error("No public key encrypted session key packet found.");await Promise.all(t.map(async function(t){await Promise.all(e.map(async function(e){const n=await e.getPrimaryUser();let a=[u.default.symmetric.aes256,u.default.symmetric.aes128,u.default.symmetric.tripledes,u.default.symmetric.cast5];n&&n.selfCertification.preferredSymmetricAlgorithms&&(a=a.concat(n.selfCertification.preferredSymmetricAlgorithms));const s=e.getKeys(t.publicKeyId).map(e=>e.keyPacket);await Promise.all(s.map(async function(e){if(e){if(!e.isDecrypted())throw new Error("Private key is not decrypted.");try{if(await t.decrypt(e),!a.includes(u.default.write(u.default.symmetric,t.sessionKeyAlgorithm)))throw new Error("A non-preferred symmetric algorithm was used.");i.push(t)}catch(n){c.default.print_debug_error(n),r=n}}}))})),n.default.cancel(t.encrypted),t.encrypted=null}))}}if(i.length){if(i.length>1){const e={};i=i.filter(function(t){const r=t.sessionKeyAlgorithm+c.default.Uint8Array_to_str(t.sessionKey);return!e.hasOwnProperty(r)&&(e[r]=!0,!0)})}return i.map(e=>({data:e.sessionKey,algorithm:e.sessionKeyAlgorithm}))}throw r||new Error("Session key decryption failed.")},p.prototype.getLiteralData=function(){const e=this.unwrapCompressed().packets.findPacket(u.default.packet.literal);return e&&e.getBytes()||null},p.prototype.getFilename=function(){const e=this.unwrapCompressed().packets.findPacket(u.default.packet.literal);return e&&e.getFilename()||null},p.prototype.getText=function(){const e=this.unwrapCompressed().packets.findPacket(u.default.packet.literal);return e?e.getText():null},p.prototype.encrypt=async function(e,t,r,n=!1,i=new Date,a=[],d){let h,p,b;if(r){if(!c.default.isUint8Array(r.data)||!c.default.isString(r.algorithm))throw new Error("Invalid session key for encryption.");h=r.algorithm,p=r.aeadAlgorithm,r=r.data}else if(e&&e.length)h=u.default.read(u.default.symmetric,await(0,l.getPreferredAlgo)("symmetric",e,i,a)),s.default.aead_protect&&4===s.default.aead_protect_version&&await(0,l.isAeadSupported)(e,i,a)&&(p=u.default.read(u.default.aead,await(0,l.getPreferredAlgo)("aead",e,i,a)));else{if(!t||!t.length)throw new Error("No keys, passwords, or session key provided.");h=u.default.read(u.default.symmetric,s.default.encryption_cipher),p=u.default.read(u.default.aead,s.default.aead_mode)}r||(r=await o.default.generateSessionKey(h));const m=await y(r,h,p,e,t,n,i,a);return s.default.aead_protect&&(4!==s.default.aead_protect_version||p)?(b=new f.default.SymEncryptedAEADProtected).aeadAlgorithm=p:b=s.default.integrity_protect?new f.default.SymEncryptedIntegrityProtected:new f.default.SymmetricallyEncrypted,b.packets=this.packets,await b.encrypt(h,r,d),m.packets.push(b),b.packets=new f.default.List,{message:m,sessionKey:{data:r,algorithm:h,aeadAlgorithm:p}}},p.prototype.sign=async function(e=[],t=null,r=new Date,n=[]){const i=new f.default.List,a=this.packets.findPacket(u.default.packet.literal);if(!a)throw new Error("No literal data packet to sign.");let s,o;const c=null===a.text?u.default.signature.binary:u.default.signature.text;if(t)for(s=(o=t.packets.filterByTag(u.default.packet.signature)).length-1;s>=0;s--){const t=o[s],r=new f.default.OnePassSignature;r.signatureType=t.signatureType,r.hashAlgorithm=t.hashAlgorithm,r.publicKeyAlgorithm=t.publicKeyAlgorithm,r.issuerKeyId=t.issuerKeyId,e.length||0!==s||(r.flags=1),i.push(r)}return await Promise.all(Array.from(e).reverse().map(async function(t,i){if(t.isPublic())throw new Error("Need private key for signing");const a=await t.getSigningKey(void 0,r,n);if(!a)throw new Error("Could not find valid key packet for signing in key "+t.getKeyId().toHex());const s=new f.default.OnePassSignature;return s.signatureType=c,s.hashAlgorithm=await(0,l.getPreferredHashAlgo)(t,a.keyPacket,r,n),s.publicKeyAlgorithm=a.keyPacket.algorithm,s.issuerKeyId=a.getKeyId(),i===e.length-1&&(s.flags=1),s})).then(e=>{e.forEach(e=>i.push(e))}),i.push(a),i.concat(await b(a,e,t,r)),new p(i)},p.prototype.compress=function(e){if(e===u.default.compression.uncompressed)return this;const t=new f.default.Compressed;t.packets=this.packets,t.algorithm=u.default.read(u.default.compression,e);const r=new f.default.List;return r.push(t),new p(r)},p.prototype.signDetached=async function(e=[],t=null,r=new Date,n=[]){const i=this.packets.findPacket(u.default.packet.literal);if(!i)throw new Error("No literal data packet to sign.");return new d.Signature(await b(i,e,t,r,n))},p.prototype.verify=async function(e,t=new Date,r){const i=this.unwrapCompressed(),a=i.packets.filterByTag(u.default.packet.literal);if(1!==a.length)throw new Error("Can only verify message with one literal data packet.");const s=i.packets.filterByTag(u.default.packet.onePassSignature).reverse(),o=i.packets.filterByTag(u.default.packet.signature);return s.length&&!o.length&&i.packets.stream?(await Promise.all(s.map(async e=>{e.correspondingSig=new Promise((t,r)=>{e.correspondingSigResolve=t,e.correspondingSigReject=r}),e.signatureData=n.default.fromAsync(async()=>(await e.correspondingSig).signatureData),e.hashed=await e.hash(e.signatureType,a[0],void 0,r)})),i.packets.stream=n.default.transformPair(i.packets.stream,async(e,t)=>{const r=n.default.getReader(e),i=n.default.getWriter(t);try{for(let e=0;e<s.length;e++){const t=(await r.read()).value;s[e].correspondingSigResolve(t)}await r.readToEnd(),await i.ready,await i.close()}catch(a){s.forEach(e=>{e.correspondingSigReject(a)}),await i.abort(a)}}),m(s,a,e,t)):m(o,a,e,t)},p.prototype.verifyDetached=function(e,t,r=new Date){const n=this.unwrapCompressed().packets.filterByTag(u.default.packet.literal);if(1!==n.length)throw new Error("Can only verify message with one literal data packet.");return m(e.packets,n,t,r)},p.prototype.unwrapCompressed=function(){const e=this.packets.filterByTag(u.default.packet.compressed);return e.length?new p(e[0].packets):this},p.prototype.appendSignature=async function(e){await this.packets.read(c.default.isUint8Array(e)?e:(await i.default.decode(e)).data)},p.prototype.armor=function(){return i.default.encode(u.default.armor.message,this.packets.write())}},{"./config":81,"./crypto":96,"./encoding/armor":113,"./enums":115,"./key":118,"./packet":127,"./signature":147,"./type/keyid":150,"./util":154,"web-stream-tools":77}],123:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.initWorker=function({path:e="openpgp.worker.min.js",n:t=1,workers:r=[]}={}){if(r.length||"undefined"!=typeof window&&window.Worker&&window.MessageChannel)return l=new f.default({path:e,n:t,workers:r,config:o.default}),!0},r.getWorker=function(){return l},r.destroyWorker=function(){l=void 0},r.generateKey=function({userIds:e=[],passphrase:t="",numBits:r=2048,keyExpirationTime:n=0,curve:i="",date:a=new Date,subkeys:o=[{}]}){const u={userIds:e=y(e),passphrase:t,numBits:r,keyExpirationTime:n,curve:i,date:a,subkeys:o};if(c.default.getWebCryptoAll()&&r<2048)throw new Error("numBits should be 2048 or 4096, found: "+r);if(!c.default.getWebCryptoAll()&&l)return l.delegate("generateKey",u);return(0,s.generate)(u).then(async e=>{const t=await e.getRevocationCertificate();return e.revocationSignatures=[],m({key:e,privateKeyArmored:e.armor(),publicKeyArmored:e.toPublic().armor(),revocationCertificate:t})}).catch(_.bind(null,"Error generating keypair"))},r.reformatKey=function({privateKey:e,userIds:t=[],passphrase:r="",keyExpirationTime:n=0,date:i,revocationCertificate:a=!0}){t=y(t);const o={privateKey:e,userIds:t,passphrase:r,keyExpirationTime:n,date:i,revocationCertificate:a};if(l)return l.delegate("reformatKey",o);return o.revoked=o.revocationCertificate,(0,s.reformat)(o).then(async e=>{const t=await e.getRevocationCertificate();return e.revocationSignatures=[],m({key:e,privateKeyArmored:e.armor(),publicKeyArmored:e.toPublic().armor(),revocationCertificate:t})}).catch(_.bind(null,"Error reformatting keypair"))},r.revokeKey=function({key:e,revocationCertificate:t,reasonForRevocation:r}={}){const n={key:e,revocationCertificate:t,reasonForRevocation:r};if(!c.default.getWebCryptoAll()&&l)return l.delegate("revokeKey",n);return Promise.resolve().then(()=>t?e.applyRevocationCertificate(t):e.revoke(r)).then(async e=>{if(await m(e),e.isPrivate()){const t=e.toPublic();return{privateKey:e,privateKeyArmored:e.armor(),publicKey:t,publicKeyArmored:t.armor()}}return{publicKey:e,publicKeyArmored:e.armor()}}).catch(_.bind(null,"Error revoking key"))},r.decryptKey=function({privateKey:e,passphrase:t}){if(l)return l.delegate("decryptKey",{privateKey:e,passphrase:t});return Promise.resolve().then(async function(){return await e.decrypt(t),{key:e}}).catch(_.bind(null,"Error decrypting private key"))},r.encryptKey=function({privateKey:e,passphrase:t}){if(l)return l.delegate("encryptKey",{privateKey:e,passphrase:t});return Promise.resolve().then(async function(){return await e.encrypt(t),{key:e}}).catch(_.bind(null,"Error decrypting private key"))},r.encrypt=function({message:e,publicKeys:t,privateKeys:r,passwords:n,sessionKey:i,compression:a=o.default.compression,armor:s=!0,streaming:u=e&&e.fromStream,detached:c=!1,signature:f=null,returnSessionKey:d=!1,wildcard:p=!1,date:b=new Date,fromUserIds:g=[],toUserIds:w=[]}){if(h(e),t=y(t),r=y(r),n=y(n),g=y(g),w=y(w),!v()&&l)return l.delegate("encrypt",{message:e,publicKeys:t,privateKeys:r,passwords:n,sessionKey:i,compression:a,armor:s,streaming:u,detached:c,signature:f,returnSessionKey:d,wildcard:p,date:b,fromUserIds:g,toUserIds:w});const k={};return Promise.resolve().then(async function(){if(r||(r=[]),r.length||f)if(c){const t=await e.signDetached(r,f,b,g);k.signature=s?t.armor():t}else e=await e.sign(r,f,b,g);return(e=e.compress(a)).encrypt(t,n,i,p,b,w,u)}).then(async e=>(s?k.data=e.message.armor():k.message=e.message,d&&(k.sessionKey=e.sessionKey),m(k,u,s?["signature","data"]:[]))).catch(_.bind(null,"Error encrypting message"))},r.decrypt=function({message:e,privateKeys:t,passwords:r,sessionKeys:n,publicKeys:i,format:a="utf8",streaming:s=e&&e.fromStream,signature:o=null,date:u=new Date}){if(h(e),i=y(i),t=y(t),r=y(r),n=y(n),!v()&&l)return l.delegate("decrypt",{message:e,privateKeys:t,passwords:r,sessionKeys:n,publicKeys:i,format:a,streaming:s,signature:o,date:u});return e.decrypt(t,r,n,s).then(async function(t){i||(i=[]);const r={};return r.signatures=o?await t.verifyDetached(o,i,u,s):await t.verify(i,u,s),r.data="binary"===a?t.getLiteralData():t.getText(),r.filename=t.getFilename(),s&&g(r,e,t.packets.stream),r.data=await b(r.data,s),s||await w(r.signatures),r}).catch(_.bind(null,"Error decrypting message"))},r.sign=function({message:e,privateKeys:t,armor:r=!0,streaming:n=e&&e.fromStream,detached:i=!1,date:a=new Date,fromUserIds:s=[]}){if(p(e),t=y(t),s=y(s),l)return l.delegate("sign",{message:e,privateKeys:t,armor:r,streaming:n,detached:i,date:a,fromUserIds:s});const o={};return Promise.resolve().then(async function(){if(i){const n=await e.signDetached(t,void 0,a,s);o.signature=r?n.armor():n}else e=await e.sign(t,void 0,a,s),r?o.data=e.armor():o.message=e;return m(o,n,r?["signature","data"]:[])}).catch(_.bind(null,"Error signing cleartext message"))},r.verify=function({message:e,publicKeys:t,streaming:r=e&&e.fromStream,signature:n=null,date:i=new Date}){if(p(e),t=y(t),l)return l.delegate("verify",{message:e,publicKeys:t,streaming:r,signature:n,date:i});return Promise.resolve().then(async function(){const s={};return s.signatures=n?await e.verifyDetached(n,t,i,r):await e.verify(t,i,r),s.data=e instanceof a.CleartextMessage?e.getText():e.getLiteralData(),r&&g(s,e),s.data=await b(s.data,r),r||await w(s.signatures),s}).catch(_.bind(null,"Error verifying cleartext signed message"))},r.encryptSessionKey=function({data:e,algorithm:t,aeadAlgorithm:r,publicKeys:n,passwords:a,wildcard:s=!1,date:o=new Date,toUserIds:u=[]}){if(function(e,t){if(!c.default.isUint8Array(e))throw new Error("Parameter ["+(t||"data")+"] must be of type Uint8Array")}(e),function(e,t){if(!c.default.isString(e))throw new Error("Parameter ["+(t||"data")+"] must be of type String")}(t,"algorithm"),n=y(n),a=y(a),u=y(u),l)return l.delegate("encryptSessionKey",{data:e,algorithm:t,aeadAlgorithm:r,publicKeys:n,passwords:a,wildcard:s,date:o,toUserIds:u});return Promise.resolve().then(async function(){return{message:await i.encryptSessionKey(e,t,r,n,a,s,o,u)}}).catch(_.bind(null,"Error encrypting session key"))},r.decryptSessionKeys=function({message:e,privateKeys:t,passwords:r}){if(h(e),t=y(t),r=y(r),l)return l.delegate("decryptSessionKeys",{message:e,privateKeys:t,passwords:r});return Promise.resolve().then(async function(){return e.decryptSessionKeys(t,r)}).catch(_.bind(null,"Error decrypting session keys"))};var n=d(e("web-stream-tools")),i=function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t}(e("./message")),a=e("./cleartext"),s=e("./key"),o=d(e("./config/config")),u=d(e("./enums"));e("./polyfills");var c=d(e("./util")),f=d(e("./worker/async_proxy"));function d(e){return e&&e.__esModule?e:{default:e}}let l;function h(e){if(!(e instanceof i.Message))throw new Error("Parameter [message] needs to be of type Message")}function p(e){if(!(e instanceof a.CleartextMessage||e instanceof i.Message))throw new Error("Parameter [message] needs to be of type Message or CleartextMessage")}function y(e){return e&&!c.default.isArray(e)&&(e=[e]),e}async function b(e,t){return!t&&c.default.isStream(e)?n.default.readToEnd(e):(t&&!c.default.isStream(e)&&(e=new ReadableStream({start(t){t.enqueue(e),t.close()}})),"node"===t&&(e=n.default.webToNode(e)),e)}async function m(e,t,r=[]){return Object.prototype.isPrototypeOf(e)&&!Uint8Array.prototype.isPrototypeOf(e)&&await Promise.all(Object.entries(e).map(async([n,i])=>{c.default.isStream(i)||r.includes(n)?e[n]=await b(i,t):await m(e[n],t)})),e}function g(e,t,r){e.data=n.default.transformPair(t.packets.stream,async(t,i)=>{await n.default.pipe(e.data,i,{preventClose:!0});const a=n.default.getWriter(i);try{await n.default.readToEnd(r||t,e=>e),await a.close()}catch(s){await a.abort(s)}})}async function w(e){await Promise.all(e.map(async e=>{e.signature=await e.signature;try{e.valid=await e.verified}catch(t){e.valid=null,e.error=t,c.default.print_debug_error(t)}}))}function _(e,t){c.default.print_debug_error(t);try{t.message=e+": "+t.message}catch(r){}throw t}function v(){return o.default.aead_protect&&((4!==o.default.aead_protect_version||o.default.aead_mode===u.default.aead.experimental_gcm)&&c.default.getWebCrypto()||4===o.default.aead_protect_version&&o.default.aead_mode===u.default.aead.eax&&c.default.getWebCrypto())}},{"./cleartext":79,"./config/config":80,"./enums":115,"./key":118,"./message":122,"./polyfills":146,"./util":154,"./worker/async_proxy":156,"web-stream-tools":77}],124:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.Trust=r.Signature=r.SecretSubkey=r.Userid=r.SecretKey=r.OnePassSignature=r.UserAttribute=r.PublicSubkey=r.Marker=r.SymmetricallyEncrypted=r.PublicKey=r.Literal=r.SymEncryptedSessionKey=r.PublicKeyEncryptedSessionKey=r.SymEncryptedAEADProtected=r.SymEncryptedIntegrityProtected=r.Compressed=void 0;var n=e("./compressed.js");Object.defineProperty(r,"Compressed",{enumerable:!0,get:function(){return k(n).default}});var i=e("./sym_encrypted_integrity_protected.js");Object.defineProperty(r,"SymEncryptedIntegrityProtected",{enumerable:!0,get:function(){return k(i).default}});var a=e("./sym_encrypted_aead_protected.js");Object.defineProperty(r,"SymEncryptedAEADProtected",{enumerable:!0,get:function(){return k(a).default}});var s=e("./public_key_encrypted_session_key.js");Object.defineProperty(r,"PublicKeyEncryptedSessionKey",{enumerable:!0,get:function(){return k(s).default}});var o=e("./sym_encrypted_session_key.js");Object.defineProperty(r,"SymEncryptedSessionKey",{enumerable:!0,get:function(){return k(o).default}});var u=e("./literal.js");Object.defineProperty(r,"Literal",{enumerable:!0,get:function(){return k(u).default}});var c=e("./public_key.js");Object.defineProperty(r,"PublicKey",{enumerable:!0,get:function(){return k(c).default}});var f=e("./symmetrically_encrypted.js");Object.defineProperty(r,"SymmetricallyEncrypted",{enumerable:!0,get:function(){return k(f).default}});var d=e("./marker.js");Object.defineProperty(r,"Marker",{enumerable:!0,get:function(){return k(d).default}});var l=e("./public_subkey.js");Object.defineProperty(r,"PublicSubkey",{enumerable:!0,get:function(){return k(l).default}});var h=e("./user_attribute.js");Object.defineProperty(r,"UserAttribute",{enumerable:!0,get:function(){return k(h).default}});var p=e("./one_pass_signature.js");Object.defineProperty(r,"OnePassSignature",{enumerable:!0,get:function(){return k(p).default}});var y=e("./secret_key.js");Object.defineProperty(r,"SecretKey",{enumerable:!0,get:function(){return k(y).default}});var b=e("./userid.js");Object.defineProperty(r,"Userid",{enumerable:!0,get:function(){return k(b).default}});var m=e("./secret_subkey.js");Object.defineProperty(r,"SecretSubkey",{enumerable:!0,get:function(){return k(m).default}});var g=e("./signature.js");Object.defineProperty(r,"Signature",{enumerable:!0,get:function(){return k(g).default}});var w=e("./trust.js");Object.defineProperty(r,"Trust",{enumerable:!0,get:function(){return k(w).default}}),r.newPacketFromTag=A,r.fromStructuredClone=function(e){const t=A(_.default.read(_.default.packet,e.tag));Object.assign(t,e),t.postCloneTypeFix&&t.postCloneTypeFix();return t};var _=k(e("../enums.js")),v=function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t}(e("./all_packets.js"));function k(e){return e&&e.__esModule?e:{default:e}}function A(e){return new(v[function(e){return e.substr(0,1).toUpperCase()+e.substr(1)}(e)])}},{"../enums.js":115,"./all_packets.js":124,"./compressed.js":126,"./literal.js":128,"./marker.js":129,"./one_pass_signature.js":130,"./public_key.js":133,"./public_key_encrypted_session_key.js":134,"./public_subkey.js":135,"./secret_key.js":136,"./secret_subkey.js":137,"./signature.js":138,"./sym_encrypted_aead_protected.js":139,"./sym_encrypted_integrity_protected.js":140,"./sym_encrypted_session_key.js":141,"./symmetrically_encrypted.js":142,"./trust.js":143,"./user_attribute.js":144,"./userid.js":145}],125:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.clonePackets=function(e){e.publicKeys&&(e.publicKeys=e.publicKeys.map(e=>e.toPacketlist()));e.privateKeys&&(e.privateKeys=e.privateKeys.map(e=>e.toPacketlist()));e.privateKey&&(e.privateKey=e.privateKey.toPacketlist());e.key&&(e.key=e.key.toPacketlist());e.message&&(e.message instanceof a.Message?e.message=e.message.packets:e.message instanceof s.CleartextMessage&&(e.message={text:e.message.text,signature:e.message.signature.packets}));e.signature&&e.signature instanceof o.Signature&&(e.signature=e.signature.packets);e.signatures&&e.signatures.forEach(l);return e},r.parseClonedPackets=function(e){e.publicKeys&&(e.publicKeys=e.publicKeys.map(h));e.privateKeys&&(e.privateKeys=e.privateKeys.map(h));e.privateKey&&(e.privateKey=h(e.privateKey));e.key&&(e.key=h(e.key));e.message&&e.message.signature?e.message=function(e){const t=u.default.fromStructuredClone(e.signature);return new s.CleartextMessage(e.text,new o.Signature(t))}(e.message):e.message&&(e.message=function(e){const t=u.default.fromStructuredClone(e);return new a.Message(t)}(e.message));e.signatures&&(e.signatures=e.signatures.map(p));e.signature&&(e.signature=function(e){if(f.default.isString(e)||f.default.isStream(e))return e;const t=u.default.fromStructuredClone(e);return new o.Signature(t)}(e.signature));return e};var n=d(e("web-stream-tools")),i=e("../key"),a=e("../message"),s=e("../cleartext"),o=e("../signature"),u=d(e("./packetlist")),c=d(e("../type/keyid")),f=d(e("../util"));function d(e){return e&&e.__esModule?e:{default:e}}function l(e){const t=e.verified;if(e.verified=n.default.fromAsync(()=>t),e.signature instanceof Promise){const r=e.signature;e.signature=n.default.fromAsync(async()=>{const e=(await r).packets;return await t,delete e[0].signature,e})}else e.signature=e.signature.packets;return e}function h(e){const t=u.default.fromStructuredClone(e);return new i.Key(t)}function p(e){return e.keyid=c.default.fromClone(e.keyid),f.default.isStream(e.signature)?e.signature=n.default.readToEnd(e.signature,([e])=>new o.Signature(u.default.fromStructuredClone(e))):e.signature=new o.Signature(u.default.fromStructuredClone(e.signature)),e.verified=n.default.readToEnd(e.verified,([e])=>e),e}},{"../cleartext":79,"../key":118,"../message":122,"../signature":147,"../type/keyid":150,"../util":154,"./packetlist":132,"web-stream-tools":77}],126:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=c(e("pako")),i=c(e("seek-bzip")),a=c(e("web-stream-tools")),s=c(e("../config")),o=c(e("../enums")),u=c(e("../util"));function c(e){return e&&e.__esModule?e:{default:e}}function f(){this.tag=o.default.packet.compressed,this.packets=null,this.algorithm="zip",this.compressed=null}f.prototype.read=async function(e){await a.default.parse(e,async e=>{this.algorithm=o.default.read(o.default.compression,await e.readByte()),this.compressed=e.remainder(),await this.decompress()})},f.prototype.write=function(){return null===this.compressed&&this.compress(),u.default.concat([new Uint8Array([o.default.write(o.default.compression,this.algorithm)]),this.compressed])},f.prototype.decompress=async function(){if(!b[this.algorithm])throw new Error(this.algorithm+" decompression not supported");await this.packets.read(b[this.algorithm](this.compressed))},f.prototype.compress=function(){if(!y[this.algorithm])throw new Error(this.algorithm+" compression not supported");this.compressed=y[this.algorithm](this.packets.write())},r.default=f;const d=u.default.getNodeZlib();function l(e,t={}){return function(r){return a.default.nodeToWeb(a.default.webToNode(r).pipe(e(t)))}}function h(e,t={}){return function(r){const i=new e(t);return a.default.transform(r,e=>{if(e.length)return i.push(e,n.default.Z_SYNC_FLUSH),i.result},()=>(i.push([],n.default.Z_FINISH),i.result))}}function p(e){return function(t){return a.default.fromAsync(async()=>e(await a.default.readToEnd(t)))}}let y,b;d?(y={zip:l(d.createDeflateRaw,{level:s.default.deflate_level}),zlib:l(d.createDeflate,{level:s.default.deflate_level})},b={zip:l(d.createInflateRaw),zlib:l(d.createInflate),bzip2:p(i.default.decode)}):(y={zip:h(n.default.Deflate,{raw:!0,level:s.default.deflate_level}),zlib:h(n.default.Deflate,{level:s.default.deflate_level})},b={zip:h(n.default.Inflate,{raw:!0}),zlib:h(n.default.Inflate),bzip2:p(i.default.decode)})},{"../config":81,"../enums":115,"../util":154,pako:52,"seek-bzip":71,"web-stream-tools":77}],127:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=o(e("./all_packets")),a=o(e("./clone")),s=e("./packetlist");function o(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t}const u={List:((n=s)&&n.__esModule?n:{default:n}).default,clone:a};Object.assign(u,i),r.default=u},{"./all_packets":124,"./clone":125,"./packetlist":132}],128:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=s(e("web-stream-tools")),i=s(e("../enums")),a=s(e("../util"));function s(e){return e&&e.__esModule?e:{default:e}}function o(e=new Date){this.tag=i.default.packet.literal,this.format="utf8",this.date=a.default.normalizeDate(e),this.text=null,this.data=null,this.filename="msg.txt"}o.prototype.setText=function(e,t="utf8"){this.format=t,this.text=e,this.data=null},o.prototype.getText=function(e=!1){return(null===this.text||a.default.isStream(this.text))&&(this.text=a.default.nativeEOL(a.default.decode_utf8(this.getBytes(e)))),this.text},o.prototype.setBytes=function(e,t){this.format=t,this.data=e,this.text=null},o.prototype.getBytes=function(e=!1){return null===this.data&&(this.data=a.default.encode_utf8(a.default.canonicalizeEOL(this.text))),e?n.default.passiveClone(this.data):this.data},o.prototype.setFilename=function(e){this.filename=e},o.prototype.getFilename=function(){return this.filename},o.prototype.read=async function(e){await n.default.parse(e,async e=>{const t=i.default.read(i.default.literal,await e.readByte()),r=await e.readByte();this.filename=a.default.decode_utf8(await e.readBytes(r)),this.date=a.default.readDate(await e.readBytes(4));const n=e.remainder();this.setBytes(n,t)})},o.prototype.write=function(){const e=a.default.encode_utf8(this.filename),t=new Uint8Array([e.length]),r=new Uint8Array([i.default.write(i.default.literal,this.format)]),n=a.default.writeDate(this.date),s=this.getBytes();return a.default.concat([r,t,e,n,s])},r.default=o},{"../enums":115,"../util":154,"web-stream-tools":77}],129:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../enums"),a=(n=i)&&n.__esModule?n:{default:n};function s(){this.tag=a.default.packet.marker}s.prototype.read=function(e){return 80===e[0]&&71===e[1]&&80===e[2]},r.default=s},{"../enums":115}],130:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=o(e("./signature")),i=o(e("../type/keyid")),a=o(e("../enums")),s=o(e("../util"));function o(e){return e&&e.__esModule?e:{default:e}}function u(){this.tag=a.default.packet.onePassSignature,this.version=null,this.signatureType=null,this.hashAlgorithm=null,this.publicKeyAlgorithm=null,this.issuerKeyId=null,this.flags=null}u.prototype.read=function(e){let t=0;return this.version=e[t++],this.signatureType=e[t++],this.hashAlgorithm=e[t++],this.publicKeyAlgorithm=e[t++],this.issuerKeyId=new i.default,this.issuerKeyId.read(e.subarray(t,t+8)),t+=8,this.flags=e[t++],this},u.prototype.write=function(){const e=new Uint8Array([3,a.default.write(a.default.signature,this.signatureType),a.default.write(a.default.hash,this.hashAlgorithm),a.default.write(a.default.publicKey,this.publicKeyAlgorithm)]),t=new Uint8Array([this.flags]);return s.default.concatUint8Array([e,this.issuerKeyId.write(),t])},u.prototype.postCloneTypeFix=function(){this.issuerKeyId=i.default.fromClone(this.issuerKeyId)},u.prototype.hash=function(){const e=this.version;this.version=4;try{return n.default.prototype.hash.apply(this,arguments)}finally{this.version=e}},u.prototype.toHash=n.default.prototype.toHash,u.prototype.toSign=n.default.prototype.toSign,u.prototype.calculateTrailer=n.default.prototype.calculateTrailer,u.prototype.verify=async function(){const e=await this.correspondingSig;if(!e||e.tag!==a.default.packet.signature)throw new Error("Corresponding signature packet missing");if(e.signatureType!==this.signatureType||e.hashAlgorithm!==this.hashAlgorithm||e.publicKeyAlgorithm!==this.publicKeyAlgorithm||!e.issuerKeyId.equals(this.issuerKeyId))throw new Error("Corresponding signature packet does not match one-pass signature packet");return e.hashed=this.hashed,e.verify.apply(e,arguments)},r.default=u},{"../enums":115,"../type/keyid":150,"../util":154,"./signature":138}],131:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=function(){return function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var r=[],n=!0,i=!1,a=void 0;try{for(var s,o=e[Symbol.iterator]();!(n=(s=o.next()).done)&&(r.push(s.value),!t||r.length!==t);n=!0);}catch(u){i=!0,a=u}finally{try{!n&&o.return&&o.return()}finally{if(i)throw a}}return r}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),i=o(e("web-stream-tools")),a=o(e("../enums")),s=o(e("../util"));function o(e){return e&&e.__esModule?e:{default:e}}r.default={readSimpleLength:function(e){let t,r=0;const i=e[0];i<192?(r=n(e,1)[0],t=1):i<255?(r=(e[0]-192<<8)+e[1]+192,t=2):255===i&&(r=s.default.readNumber(e.subarray(1,5)),t=5);return{len:r,offset:t}},writeSimpleLength:function(e){return e<192?new Uint8Array([e]):e>191&&e<8384?new Uint8Array([192+(e-192>>8),e-192&255]):s.default.concatUint8Array([new Uint8Array([255]),s.default.writeNumber(e,4)])},writePartialLength:function(e){if(e<0||e>30)throw new Error("Partial Length power must be between 1 and 30");return new Uint8Array([224+e])},writeTag:function(e){return new Uint8Array([192|e])},writeHeader:function(e,t){return s.default.concatUint8Array([this.writeTag(e),this.writeSimpleLength(t)])},writeOldHeader:function(e,t){return t<256?new Uint8Array([128|e<<2,t]):t<65536?s.default.concatUint8Array([new Uint8Array([129|e<<2]),s.default.writeNumber(t,2)]):s.default.concatUint8Array([new Uint8Array([130|e<<2]),s.default.writeNumber(t,4)])},supportsStreaming:function(e){return[a.default.packet.literal,a.default.packet.compressed,a.default.packet.symmetricallyEncrypted,a.default.packet.symEncryptedIntegrityProtected,a.default.packet.symEncryptedAEADProtected].includes(e)},read:async function(e,t){const r=i.default.getReader(e);let n;try{const e=await r.peekBytes(2);if(!e||e.length<2||0==(128&e[0]))throw new Error("Error during parsing. This message / key probably does not conform to a valid OpenPGP format.");const o=await r.readByte();let u,c,f=-1,d=-1;d=0,0!=(64&o)&&(d=1),d?f=63&o:(f=(63&o)>>2,c=3&o);const l=this.supportsStreaming(f);let h,p,y=null;if(l){const e=new TransformStream;n=i.default.getWriter(e.writable),h=t({tag:f,packet:y=e.readable})}do{if(d){const e=await r.readByte();if(p=!1,e<192)u=e;else if(e>=192&&e<224)u=(e-192<<8)+await r.readByte()+192;else if(e>223&&e<255){if(u=1<<(31&e),p=!0,!l)throw new TypeError("This packet type does not support partial lengths.")}else u=await r.readByte()<<24|await r.readByte()<<16|await r.readByte()<<8|await r.readByte()}else switch(c){case 0:u=await r.readByte();break;case 1:u=await r.readByte()<<8|await r.readByte();break;case 2:u=await r.readByte()<<24|await r.readByte()<<16|await r.readByte()<<8|await r.readByte();break;default:u=1/0}if(n&&u>0){let e=0;for(;;){await n.ready;var a=await r.read();const t=a.done,i=a.value;if(t){if(u===1/0)break;throw new Error("Unexpected end of packet")}if(await n.write(i.slice(0,u-e)),(e+=i.length)>=u){r.unshift(i.slice(u-e+i.length));break}}}}while(p);l||(y=await r.readBytes(u),await t({tag:f,packet:y}));const b=await r.peekBytes(2);return n&&(await n.ready,await n.close()),l&&await h,!b||!b.length}catch(s){if(n)return await n.abort(s),!0;throw s}finally{r.releaseLock()}}}},{"../enums":115,"../util":154,"web-stream-tools":77}],132:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=c(e("web-stream-tools")),i=function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t}(e("./all_packets")),a=c(e("./packet")),s=c(e("../config")),o=c(e("../enums")),u=c(e("../util"));function c(e){return e&&e.__esModule?e:{default:e}}function f(){this.length=0}f.prototype=[],f.prototype.read=async function(e){this.stream=n.default.transformPair(e,async(e,t)=>{const r=n.default.getWriter(t);try{for(;;){if(await r.ready,await a.default.read(e,async e=>{try{const n=o.default.read(o.default.packet,e.tag),c=i.newPacketFromTag(n);c.packets=new f,c.fromStream=u.default.isStream(e.packet),await c.read(e.packet),await r.write(c)}catch(t){s.default.tolerant&&!a.default.supportsStreaming(e.tag)||await r.abort(t),u.default.print_debug_error(t)}}))return await r.ready,void(await r.close())}}catch(c){await r.abort(c)}});const t=n.default.getReader(this.stream);for(;;){var r=await t.read();const e=r.done,n=r.value;if(e?this.stream=null:this.push(n),e||n.fromStream)break}t.releaseLock()},f.prototype.write=function(){const e=[];for(let t=0;t<this.length;t++){const r=this[t].write();if(u.default.isStream(r)&&a.default.supportsStreaming(this[t].tag)){let i=[],s=0;const o=512;e.push(a.default.writeTag(this[t].tag)),e.push(n.default.transform(r,e=>{if(i.push(e),(s+=e.length)>=o){const e=Math.min(Math.log(s)/Math.LN2|0,30),t=2**e,r=u.default.concat([a.default.writePartialLength(e)].concat(i));return i=[r.subarray(1+t)],s=i[0].length,r.subarray(0,1+t)}},()=>u.default.concat([a.default.writeSimpleLength(s)].concat(i))))}else{if(u.default.isStream(r)){let i=0;e.push(n.default.transform(n.default.clone(r),e=>{i+=e.length},()=>a.default.writeHeader(this[t].tag,i)))}else e.push(a.default.writeHeader(this[t].tag,r.length));e.push(r)}}return u.default.concat(e)},f.prototype.push=function(e){e&&(e.packets=e.packets||new f,this[this.length]=e,this.length++)},f.prototype.filterByTag=function(...e){const t=new f,r=e=>t=>e===t;for(let n=0;n<this.length;n++)e.some(r(this[n].tag))&&t.push(this[n]);return t},f.prototype.findPacket=function(e){return this.find(t=>t.tag===e)},f.prototype.indexOfTag=function(...e){const t=[],r=this,n=e=>t=>e===t;for(let i=0;i<this.length;i++)e.some(n(r[i].tag))&&t.push(i);return t},f.prototype.concat=function(e){if(e)for(let t=0;t<e.length;t++)this.push(e[t]);return this},f.fromStructuredClone=function(e){const t=new f;for(let r=0;r<e.length;r++){const n=i.fromStructuredClone(e[r]);t.push(n),n.embeddedSignature&&(n.embeddedSignature=i.fromStructuredClone(n.embeddedSignature)),0!==n.packets.length?n.packets=this.fromStructuredClone(n.packets):n.packets=new f}return t},r.default=f},{"../config":81,"../enums":115,"../util":154,"./all_packets":124,"./packet":131,"web-stream-tools":77}],133:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("asmcrypto.js/dist_es5/hash/sha1/sha1"),i=e("asmcrypto.js/dist_es5/hash/sha256/sha256"),a=d(e("../type/keyid")),s=d(e("../type/mpi")),o=d(e("../config")),u=d(e("../crypto")),c=d(e("../enums")),f=d(e("../util"));function d(e){return e&&e.__esModule?e:{default:e}}function l(e=new Date){this.tag=c.default.packet.publicKey,this.version=o.default.aead_protect&&4===o.default.aead_protect_version?5:4,this.created=f.default.normalizeDate(e),this.algorithm=null,this.params=[],this.expirationTimeV3=0,this.fingerprint=null,this.keyid=null}l.prototype.read=function(e){let t=0;if(this.version=e[t++],4===this.version||5===this.version){this.created=f.default.readDate(e.subarray(t,t+4)),t+=4,this.algorithm=c.default.read(c.default.publicKey,e[t++]);const r=c.default.write(c.default.publicKey,this.algorithm);5===this.version&&(t+=4);const n=u.default.getPubKeyParamTypes(r);this.params=u.default.constructParams(n);for(let i=0;i<n.length&&t<e.length;i++)if((t+=this.params[i].read(e.subarray(t,e.length)))>e.length)throw new Error("Error reading MPI @:"+t);return t}throw new Error("Version "+this.version+" of the key packet is unsupported.")},l.prototype.readPublicKey=l.prototype.read,l.prototype.write=function(){const e=[];e.push(new Uint8Array([this.version])),e.push(f.default.writeDate(this.created));const t=c.default.write(c.default.publicKey,this.algorithm);e.push(new Uint8Array([t]));const r=u.default.getPubKeyParamTypes(t).length,n=f.default.concatUint8Array(this.params.slice(0,r).map(e=>e.write()));return 5===this.version&&e.push(f.default.writeNumber(n.length,4)),e.push(n),f.default.concatUint8Array(e)},l.prototype.writePublicKey=l.prototype.write,l.prototype.writeOld=function(){const e=this.writePublicKey();return f.default.concatUint8Array([new Uint8Array([153]),f.default.writeNumber(e.length,2),e])},l.prototype.isDecrypted=function(){return null},l.prototype.getCreationTime=function(){return this.created},l.prototype.getKeyId=function(){return this.keyid?this.keyid:(this.keyid=new a.default,5===this.version?this.keyid.read(f.default.hex_to_Uint8Array(this.getFingerprint()).subarray(0,8)):4===this.version&&this.keyid.read(f.default.hex_to_Uint8Array(this.getFingerprint()).subarray(12,20)),this.keyid)},l.prototype.getFingerprintBytes=function(){if(this.fingerprint)return this.fingerprint;let e;if(5===this.version){const t=this.writePublicKey();e=f.default.concatUint8Array([new Uint8Array([154]),f.default.writeNumber(t.length,4),t]),this.fingerprint=i.Sha256.bytes(e)}else 4===this.version&&(e=this.writeOld(),this.fingerprint=n.Sha1.bytes(e));return this.fingerprint},l.prototype.getFingerprint=function(){return f.default.Uint8Array_to_hex(this.getFingerprintBytes())},l.prototype.hasSameFingerprintAs=function(e){return this.version===e.version&&f.default.equalsUint8Array(this.writePublicKey(),e.writePublicKey())},l.prototype.getAlgorithmInfo=function(){const e={};return e.algorithm=this.algorithm,this.params[0]instanceof s.default?e.bits=8*this.params[0].byteLength():e.curve=this.params[0].getName(),e},l.prototype.postCloneTypeFix=function(){const e=c.default.write(c.default.publicKey,this.algorithm),t=u.default.getPubKeyParamTypes(e);for(let r=0;r<t.length;r++){const e=this.params[r];this.params[r]=t[r].fromClone(e)}this.keyid&&(this.keyid=a.default.fromClone(this.keyid))},r.default=l},{"../config":81,"../crypto":96,"../enums":115,"../type/keyid":150,"../type/mpi":151,"../util":154,"asmcrypto.js/dist_es5/hash/sha1/sha1":12,"asmcrypto.js/dist_es5/hash/sha256/sha256":14}],134:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("../type/keyid")),i=u(e("../type/mpi")),a=u(e("../crypto")),s=u(e("../enums")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}function c(){this.tag=s.default.packet.publicKeyEncryptedSessionKey,this.version=3,this.publicKeyId=new n.default,this.publicKeyAlgorithm=null,this.sessionKey=null,this.sessionKeyAlgorithm=null,this.encrypted=[]}c.prototype.read=function(e){this.version=e[0],this.publicKeyId.read(e.subarray(1,e.length)),this.publicKeyAlgorithm=s.default.read(s.default.publicKey,e[9]);let t=10;const r=s.default.write(s.default.publicKey,this.publicKeyAlgorithm),n=a.default.getEncSessionKeyParamTypes(r);this.encrypted=a.default.constructParams(n);for(let i=0;i<n.length;i++)t+=this.encrypted[i].read(e.subarray(t,e.length))},c.prototype.write=function(){const e=[new Uint8Array([this.version]),this.publicKeyId.write(),new Uint8Array([s.default.write(s.default.publicKey,this.publicKeyAlgorithm)])];for(let t=0;t<this.encrypted.length;t++)e.push(this.encrypted[t].write());return o.default.concatUint8Array(e)},c.prototype.encrypt=async function(e){let t,r=String.fromCharCode(s.default.write(s.default.symmetric,this.sessionKeyAlgorithm));r+=o.default.Uint8Array_to_str(this.sessionKey),r+=o.default.Uint8Array_to_str(o.default.write_checksum(this.sessionKey));const n=s.default.write(s.default.publicKey,this.publicKeyAlgorithm);return t=n===s.default.publicKey.ecdh?new i.default(a.default.pkcs5.encode(r)):new i.default(await a.default.pkcs1.eme.encode(r,e.params[0].byteLength())),this.encrypted=await a.default.publicKeyEncrypt(n,e.params,t,e.getFingerprintBytes()),!0},c.prototype.decrypt=async function(e){const t=s.default.write(s.default.publicKey,this.publicKeyAlgorithm),r=await a.default.publicKeyDecrypt(t,e.params,this.encrypted,e.getFingerprintBytes());let n,i;if(t===s.default.publicKey.ecdh?(i=a.default.pkcs5.decode(r.toString()),n=o.default.str_to_Uint8Array(i.substr(i.length-2))):(i=a.default.pkcs1.eme.decode(r.toString()),n=r.toUint8Array().slice(r.byteLength()-2)),e=o.default.str_to_Uint8Array(i.substring(1,i.length-2)),!o.default.equalsUint8Array(n,o.default.write_checksum(e)))throw new Error("Decryption error");return this.sessionKey=e,this.sessionKeyAlgorithm=s.default.read(s.default.symmetric,i.charCodeAt(0)),!0},c.prototype.postCloneTypeFix=function(){this.publicKeyId=n.default.fromClone(this.publicKeyId);const e=s.default.write(s.default.publicKey,this.publicKeyAlgorithm),t=a.default.getEncSessionKeyParamTypes(e);for(let r=0;r<this.encrypted.length;r++)this.encrypted[r]=t[r].fromClone(this.encrypted[r])},r.default=c},{"../crypto":96,"../enums":115,"../type/keyid":150,"../type/mpi":151,"../util":154}],135:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("./public_key")),i=a(e("../enums"));function a(e){return e&&e.__esModule?e:{default:e}}function s(){n.default.call(this),this.tag=i.default.packet.publicSubkey}s.prototype=new n.default,s.prototype.constructor=s,r.default=s},{"../enums":115,"./public_key":133}],136:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=c(e("./public_key")),i=c(e("../type/keyid.js")),a=c(e("../type/s2k")),s=c(e("../crypto")),o=c(e("../enums")),u=c(e("../util"));function c(e){return e&&e.__esModule?e:{default:e}}function f(e=new Date){n.default.call(this,e),this.tag=o.default.packet.secretKey,this.encrypted=null,this.isEncrypted=null}function d(e,t){const r=o.default.write(o.default.publicKey,t),n=s.default.getPrivKeyParamTypes(r),i=s.default.constructParams(n);let a=0;for(let s=0;s<n.length&&a<e.length;s++)if((a+=i[s].read(e.subarray(a,e.length)))>e.length)throw new Error("Error reading param @:"+a);return i}function l(e,t){const r=[],n=o.default.write(o.default.publicKey,t);for(let i=s.default.getPubKeyParamTypes(n).length;i<e.length;i++)r.push(e[i].write());return u.default.concatUint8Array(r)}async function h(e,t,r){return e.produce_key(t,s.default.cipher[r].keySize)}f.prototype=new n.default,f.prototype.constructor=f,f.prototype.read=function(e){const t=this.readPublicKey(e);if((e=e.subarray(t,e.length))[0])this.encrypted=e,this.isEncrypted=!0;else{const t=e.subarray(1,-2);if(!u.default.equalsUint8Array(u.default.write_checksum(t),e.subarray(-2)))throw new Error("Key checksum mismatch");const r=d(t,this.algorithm);this.params=this.params.concat(r),this.isEncrypted=!1}},f.prototype.write=function(){const e=[this.writePublicKey()];if(this.encrypted)e.push(this.encrypted);else{e.push(new Uint8Array([0]));const t=l(this.params,this.algorithm);e.push(t),e.push(u.default.write_checksum(t))}return u.default.concatUint8Array(e)},f.prototype.isDecrypted=function(){return!1===this.isEncrypted},f.prototype.encrypt=async function(e){if(this.isDecrypted()&&!e)return this.encrypted=null,!1;if(!e)throw new Error("The key must be decrypted before removing passphrase protection.");const t=new a.default;t.salt=await s.default.random.getRandomBytes(8);const r=l(this.params,this.algorithm),n=await h(t,e,"aes256"),i=s.default.cipher.aes256.blockSize,c=await s.default.random.getRandomBytes(i);let f;if(5===this.version){const e="eax",i=u.default.concatUint8Array([new Uint8Array([o.default.write(o.default.symmetric,"aes256"),o.default.write(o.default.aead,e)]),t.write(),c]);(f=[new Uint8Array([253,i.length])]).push(i);const a=s.default[e],d=await a("aes256",n),l=await d.encrypt(r,c.subarray(0,a.ivLength),new Uint8Array);f.push(u.default.writeNumber(l.length,4)),f.push(l)}else(f=[new Uint8Array([254,o.default.write(o.default.symmetric,"aes256")])]).push(t.write()),f.push(c),f.push(s.default.cfb.encrypt("aes256",n,u.default.concatUint8Array([r,await s.default.hash.sha1(r)]),c));return this.encrypted=u.default.concatUint8Array(f),!0},f.prototype.decrypt=async function(e){if(this.isDecrypted())throw new Error("Key packet is already decrypted.");let t,r,n,i=0;const c=this.encrypted[i++];if(5===this.version&&i++,255===c||254===c||253===c){t=this.encrypted[i++],t=o.default.read(o.default.symmetric,t),253===c&&(r=this.encrypted[i++],r=o.default.read(o.default.aead,r));const s=new a.default;i+=s.read(this.encrypted.subarray(i,this.encrypted.length)),n=await h(s,e,t)}else t=c,t=o.default.read(o.default.symmetric,t),n=await s.default.hash.md5(e);const f=this.encrypted.subarray(i,i+s.default.cipher[t].blockSize);i+=f.length,5===this.version&&(i+=4);const l=this.encrypted.subarray(i,this.encrypted.length);let p;if(r){const e=s.default[r];try{const r=await e(t,n);p=await r.decrypt(l,f.subarray(0,e.ivLength),new Uint8Array)}catch(b){if("Authentication tag mismatch"===b.message)throw new Error("Incorrect key passphrase: "+b.message)}}else{const e=await s.default.cfb.decrypt(t,n,l,f);let r,i;if(255===c?(i=2,p=e.subarray(0,-i),r=u.default.write_checksum(p)):(i=20,p=e.subarray(0,-i),r=await s.default.hash.sha1(p)),!u.default.equalsUint8Array(r,e.subarray(-i)))throw new Error("Incorrect key passphrase")}const y=d(p,this.algorithm);return this.params=this.params.concat(y),this.isEncrypted=!1,this.encrypted=null,!0},f.prototype.generate=async function(e,t){const r=o.default.write(o.default.publicKey,this.algorithm);this.params=await s.default.generateParams(r,e,t),this.isEncrypted=!1},f.prototype.clearPrivateParams=function(){if(!this.encrypted)throw new Error("If secret key is not encrypted, clearing private params is irreversible.");const e=o.default.write(o.default.publicKey,this.algorithm);this.params=this.params.slice(0,s.default.getPubKeyParamTypes(e).length),this.isEncrypted=!0},f.prototype.postCloneTypeFix=function(){const e=o.default.write(o.default.publicKey,this.algorithm),t=[].concat(s.default.getPubKeyParamTypes(e),s.default.getPrivKeyParamTypes(e));for(let r=0;r<this.params.length;r++){const e=this.params[r];this.params[r]=t[r].fromClone(e)}this.keyid&&(this.keyid=i.default.fromClone(this.keyid))},r.default=f},{"../crypto":96,"../enums":115,"../type/keyid.js":150,"../type/s2k":153,"../util":154,"./public_key":133}],137:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("./secret_key")),i=a(e("../enums"));function a(e){return e&&e.__esModule?e:{default:e}}function s(e=new Date){n.default.call(this,e),this.tag=i.default.packet.secretSubkey}s.prototype=new n.default,s.prototype.constructor=s,r.default=s},{"../enums":115,"./secret_key":136}],138:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=f(e("web-stream-tools")),i=f(e("./packet")),a=f(e("../type/keyid.js")),s=f(e("../type/mpi.js")),o=f(e("../crypto")),u=f(e("../enums")),c=f(e("../util"));function f(e){return e&&e.__esModule?e:{default:e}}function d(e=new Date){this.tag=u.default.packet.signature,this.version=4,this.signatureType=null,this.hashAlgorithm=null,this.publicKeyAlgorithm=null,this.signatureData=null,this.unhashedSubpackets=[],this.signedHashValue=null,this.created=c.default.normalizeDate(e),this.signatureExpirationTime=null,this.signatureNeverExpires=!0,this.exportable=null,this.trustLevel=null,this.trustAmount=null,this.regularExpression=null,this.revocable=null,this.keyExpirationTime=null,this.keyNeverExpires=null,this.preferredSymmetricAlgorithms=null,this.revocationKeyClass=null,this.revocationKeyAlgorithm=null,this.revocationKeyFingerprint=null,this.issuerKeyId=new a.default,this.notation=null,this.preferredHashAlgorithms=null,this.preferredCompressionAlgorithms=null,this.keyServerPreferences=null,this.preferredKeyServer=null,this.isPrimaryUserID=null,this.policyURI=null,this.keyFlags=null,this.signersUserId=null,this.reasonForRevocationFlag=null,this.reasonForRevocationString=null,this.features=null,this.signatureTargetPublicKeyAlgorithm=null,this.signatureTargetHashAlgorithm=null,this.signatureTargetHash=null,this.embeddedSignature=null,this.issuerKeyVersion=null,this.issuerFingerprint=null,this.preferredAeadAlgorithms=null,this.verified=null,this.revoked=null}function l(e,t){const r=[];return r.push(i.default.writeSimpleLength(t.length+1)),r.push(new Uint8Array([e])),r.push(t),c.default.concat(r)}d.prototype.read=function(e){let t=0;if(this.version=e[t++],4!==this.version)throw new Error("Version "+this.version+" of the signature is unsupported.");this.signatureType=e[t++],this.publicKeyAlgorithm=e[t++],this.hashAlgorithm=e[t++],t+=this.read_sub_packets(e.subarray(t,e.length),!0),this.signatureData=e.subarray(0,t),t+=this.read_sub_packets(e.subarray(t,e.length),!1),this.signedHashValue=e.subarray(t,t+2),t+=2,this.signature=e.subarray(t,e.length)},d.prototype.write=function(){const e=[];return e.push(this.signatureData),e.push(this.write_unhashed_sub_packets()),e.push(this.signedHashValue),e.push(n.default.clone(this.signature)),c.default.concat(e)},d.prototype.sign=async function(e,t){const r=u.default.write(u.default.signature,this.signatureType),i=u.default.write(u.default.publicKey,this.publicKeyAlgorithm),a=u.default.write(u.default.hash,this.hashAlgorithm),s=[new Uint8Array([4,r,i,a])];5===e.version&&(this.issuerKeyVersion=e.version,this.issuerFingerprint=e.getFingerprintBytes()),this.issuerKeyId=e.getKeyId(),s.push(this.write_hashed_sub_packets()),this.signatureData=c.default.concat(s);const f=this.toHash(r,t),d=await this.hash(r,t,f);this.signedHashValue=n.default.slice(n.default.clone(d),0,2);const l=e.params;return this.signature=n.default.fromAsync(async()=>o.default.signature.sign(i,a,l,f,await n.default.readToEnd(d))),this.verified=!0,!0},d.prototype.write_hashed_sub_packets=function(){const e=u.default.signatureSubpacket,t=[];let r;null!==this.created&&t.push(l(e.signature_creation_time,c.default.writeDate(this.created))),null!==this.signatureExpirationTime&&t.push(l(e.signature_expiration_time,c.default.writeNumber(this.signatureExpirationTime,4))),null!==this.exportable&&t.push(l(e.exportable_certification,new Uint8Array([this.exportable?1:0]))),null!==this.trustLevel&&(r=new Uint8Array([this.trustLevel,this.trustAmount]),t.push(l(e.trust_signature,r))),null!==this.regularExpression&&t.push(l(e.regular_expression,this.regularExpression)),null!==this.revocable&&t.push(l(e.revocable,new Uint8Array([this.revocable?1:0]))),null!==this.keyExpirationTime&&t.push(l(e.key_expiration_time,c.default.writeNumber(this.keyExpirationTime,4))),null!==this.preferredSymmetricAlgorithms&&(r=c.default.str_to_Uint8Array(c.default.Uint8Array_to_str(this.preferredSymmetricAlgorithms)),t.push(l(e.preferred_symmetric_algorithms,r))),null!==this.revocationKeyClass&&(r=new Uint8Array([this.revocationKeyClass,this.revocationKeyAlgorithm]),r=c.default.concat([r,this.revocationKeyFingerprint]),t.push(l(e.revocation_key,r))),null!==this.notation&&Object.entries(this.notation).forEach(([n,i])=>{(r=[new Uint8Array([128,0,0,0])]).push(c.default.writeNumber(n.length,2)),r.push(c.default.writeNumber(i.length,2)),r.push(c.default.str_to_Uint8Array(n+i)),r=c.default.concat(r),t.push(l(e.notation_data,r))}),null!==this.preferredHashAlgorithms&&(r=c.default.str_to_Uint8Array(c.default.Uint8Array_to_str(this.preferredHashAlgorithms)),t.push(l(e.preferred_hash_algorithms,r))),null!==this.preferredCompressionAlgorithms&&(r=c.default.str_to_Uint8Array(c.default.Uint8Array_to_str(this.preferredCompressionAlgorithms)),t.push(l(e.preferred_compression_algorithms,r))),null!==this.keyServerPreferences&&(r=c.default.str_to_Uint8Array(c.default.Uint8Array_to_str(this.keyServerPreferences)),t.push(l(e.key_server_preferences,r))),null!==this.preferredKeyServer&&t.push(l(e.preferred_key_server,c.default.str_to_Uint8Array(this.preferredKeyServer))),null!==this.isPrimaryUserID&&t.push(l(e.primary_user_id,new Uint8Array([this.isPrimaryUserID?1:0]))),null!==this.policyURI&&t.push(l(e.policy_uri,c.default.str_to_Uint8Array(this.policyURI))),null!==this.keyFlags&&(r=c.default.str_to_Uint8Array(c.default.Uint8Array_to_str(this.keyFlags)),t.push(l(e.key_flags,r))),null!==this.signersUserId&&t.push(l(e.signers_user_id,c.default.str_to_Uint8Array(this.signersUserId))),null!==this.reasonForRevocationFlag&&(r=c.default.str_to_Uint8Array(String.fromCharCode(this.reasonForRevocationFlag)+this.reasonForRevocationString),t.push(l(e.reason_for_revocation,r))),null!==this.features&&(r=c.default.str_to_Uint8Array(c.default.Uint8Array_to_str(this.features)),t.push(l(e.features,r))),null!==this.signatureTargetPublicKeyAlgorithm&&((r=[new Uint8Array([this.signatureTargetPublicKeyAlgorithm,this.signatureTargetHashAlgorithm])]).push(c.default.str_to_Uint8Array(this.signatureTargetHash)),r=c.default.concat(r),t.push(l(e.signature_target,r))),null!==this.preferredAeadAlgorithms&&(r=c.default.str_to_Uint8Array(c.default.Uint8Array_to_str(this.preferredAeadAlgorithms)),t.push(l(e.preferred_aead_algorithms,r)));const n=c.default.concat(t),i=c.default.writeNumber(n.length,2);return c.default.concat([i,n])},d.prototype.write_unhashed_sub_packets=function(){const e=u.default.signatureSubpacket,t=[];let r;this.issuerKeyId.isNull()||5===this.issuerKeyVersion||t.push(l(e.issuer,this.issuerKeyId.write())),null!==this.embeddedSignature&&t.push(l(e.embedded_signature,this.embeddedSignature.write())),null!==this.issuerFingerprint&&(r=[new Uint8Array([this.issuerKeyVersion]),this.issuerFingerprint],r=c.default.concat(r),t.push(l(e.issuer_fingerprint,r))),this.unhashedSubpackets.forEach(e=>{t.push(i.default.writeSimpleLength(e.length)),t.push(e)});const n=c.default.concat(t),a=c.default.writeNumber(n.length,2);return c.default.concat([a,n])},d.prototype.read_sub_packet=function(e,t=!0){let r=0;const n=(e,t)=>{this[e]=[];for(let r=0;r<t.length;r++)this[e].push(t[r])},i=128&e[r],a=127&e[r];if(t||[u.default.signatureSubpacket.issuer,u.default.signatureSubpacket.issuer_fingerprint,u.default.signatureSubpacket.embedded_signature].includes(a))switch(r++,a){case 2:this.created=c.default.readDate(e.subarray(r,e.length));break;case 3:{const t=c.default.readNumber(e.subarray(r,e.length));this.signatureNeverExpires=0===t,this.signatureExpirationTime=t;break}case 4:this.exportable=1===e[r++];break;case 5:this.trustLevel=e[r++],this.trustAmount=e[r++];break;case 6:this.regularExpression=e[r];break;case 7:this.revocable=1===e[r++];break;case 9:{const t=c.default.readNumber(e.subarray(r,e.length));this.keyExpirationTime=t,this.keyNeverExpires=0===t;break}case 11:n("preferredSymmetricAlgorithms",e.subarray(r,e.length));break;case 12:this.revocationKeyClass=e[r++],this.revocationKeyAlgorithm=e[r++],this.revocationKeyFingerprint=e.subarray(r,r+20);break;case 16:this.issuerKeyId.read(e.subarray(r,e.length));break;case 20:if(128===e[r]){r+=4;const t=c.default.readNumber(e.subarray(r,r+2));r+=2;const n=c.default.readNumber(e.subarray(r,r+2));r+=2;const i=c.default.Uint8Array_to_str(e.subarray(r,r+t)),a=c.default.Uint8Array_to_str(e.subarray(r+t,r+t+n));this.notation=this.notation||{},this.notation[i]=a}else c.default.print_debug("Unsupported notation flag "+e[r]);break;case 21:n("preferredHashAlgorithms",e.subarray(r,e.length));break;case 22:n("preferredCompressionAlgorithms",e.subarray(r,e.length));break;case 23:n("keyServerPreferences",e.subarray(r,e.length));break;case 24:this.preferredKeyServer=c.default.Uint8Array_to_str(e.subarray(r,e.length));break;case 25:this.isPrimaryUserID=0!==e[r++];break;case 26:this.policyURI=c.default.Uint8Array_to_str(e.subarray(r,e.length));break;case 27:n("keyFlags",e.subarray(r,e.length));break;case 28:this.signersUserId=c.default.Uint8Array_to_str(e.subarray(r,e.length));break;case 29:this.reasonForRevocationFlag=e[r++],this.reasonForRevocationString=c.default.Uint8Array_to_str(e.subarray(r,e.length));break;case 30:n("features",e.subarray(r,e.length));break;case 31:{this.signatureTargetPublicKeyAlgorithm=e[r++],this.signatureTargetHashAlgorithm=e[r++];const t=o.default.getHashByteLength(this.signatureTargetHashAlgorithm);this.signatureTargetHash=c.default.Uint8Array_to_str(e.subarray(r,r+t));break}case 32:this.embeddedSignature=new d,this.embeddedSignature.read(e.subarray(r,e.length));break;case 33:this.issuerKeyVersion=e[r++],this.issuerFingerprint=e.subarray(r,e.length),5===this.issuerKeyVersion?this.issuerKeyId.read(this.issuerFingerprint):this.issuerKeyId.read(this.issuerFingerprint.subarray(-8));break;case 34:n.call(this,"preferredAeadAlgorithms",e.subarray(r,e.length));break;default:{const e=new Error("Unknown signature subpacket type "+a+" @:"+r);if(i)throw e;c.default.print_debug(e)}}else this.unhashedSubpackets.push(e.subarray(r,e.length))},d.prototype.read_sub_packets=function(e,t=!0){const r=c.default.readNumber(e.subarray(0,2));let n=2;for(;n<2+r;){const r=i.default.readSimpleLength(e.subarray(n,e.length));n+=r.offset,this.read_sub_packet(e.subarray(n,n+r.len),t),n+=r.len}return n},d.prototype.toSign=function(e,t){const r=u.default.signature;switch(e){case r.binary:return null!==t.text?c.default.str_to_Uint8Array(t.getText(!0)):t.getBytes(!0);case r.text:{let e=t.getText(!0);return e=c.default.canonicalizeEOL(e),c.default.encode_utf8(e)}case r.standalone:return new Uint8Array(0);case r.cert_generic:case r.cert_persona:case r.cert_casual:case r.cert_positive:case r.cert_revocation:{let e,n;if(t.userId)n=180,e=t.userId;else{if(!t.userAttribute)throw new Error("Either a userId or userAttribute packet needs to be supplied for certification.");n=209,e=t.userAttribute}const i=e.write();return c.default.concat([this.toSign(r.key,t),new Uint8Array([n]),c.default.writeNumber(i.length,4),i])}case r.subkey_binding:case r.subkey_revocation:case r.key_binding:return c.default.concat([this.toSign(r.key,t),this.toSign(r.key,{key:t.bind})]);case r.key:if(void 0===t.key)throw new Error("Key packet is required for this signature.");return t.key.writeOld();case r.key_revocation:return this.toSign(r.key,t);case r.timestamp:return new Uint8Array(0);case r.third_party:throw new Error("Not implemented");default:throw new Error("Unknown signature type.")}},d.prototype.calculateTrailer=function(){let e=0;return n.default.transform(n.default.clone(this.signatureData),t=>{e+=t.length},()=>{const t=new Uint8Array([4,255]);return c.default.concat([t,c.default.writeNumber(e,4)])})},d.prototype.toHash=function(e,t){const r=this.toSign(e,t);return c.default.concat([r,this.signatureData,this.calculateTrailer()])},d.prototype.hash=async function(e,t,r,i=!0){const a=u.default.write(u.default.hash,this.hashAlgorithm);return r||(r=this.toHash(e,t)),!i&&c.default.isStream(r)?n.default.fromAsync(async()=>this.hash(e,t,await n.default.readToEnd(r))):o.default.hash.digest(a,r)},d.prototype.verify=async function(e,t,r){const i=u.default.write(u.default.publicKey,this.publicKeyAlgorithm),a=u.default.write(u.default.hash,this.hashAlgorithm);if(i!==u.default.write(u.default.publicKey,e.algorithm))throw new Error("Public key algorithm used to sign signature does not match issuer key algorithm.");let c,f;if(this.hashed?f=this.hashed:(c=this.toHash(t,r),f=await this.hash(t,r,c)),f=await n.default.readToEnd(f),this.signedHashValue[0]!==f[0]||this.signedHashValue[1]!==f[1])this.verified=!1;else{let t=0;i>0&&i<4?t=1:i!==u.default.publicKey.dsa&&i!==u.default.publicKey.ecdsa&&i!==u.default.publicKey.eddsa||(t=2);const r=i===u.default.publicKey.eddsa?"le":"be",d=[];let l=0;this.signature=await n.default.readToEnd(this.signature);for(let e=0;e<t;e++)d[e]=new s.default,l+=d[e].read(this.signature.subarray(l,this.signature.length),r);this.verified=await o.default.signature.verify(i,a,d,e.params,c,f)}return this.verified},d.prototype.isExpired=function(e=new Date){const t=c.default.normalizeDate(e);if(null!==t){const e=this.getExpirationTime();return!(this.created<=t&&t<=e)}return!1},d.prototype.getExpirationTime=function(){return this.signatureNeverExpires?1/0:new Date(this.created.getTime()+1e3*this.signatureExpirationTime)},d.prototype.postCloneTypeFix=function(){this.issuerKeyId=a.default.fromClone(this.issuerKeyId)},r.default=d},{"../crypto":96,"../enums":115,"../type/keyid.js":150,"../type/mpi.js":151,"../util":154,"./packet":131,"web-stream-tools":77}],139:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("web-stream-tools")),i=u(e("../config")),a=u(e("../crypto")),s=u(e("../enums")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}const c=1;function f(){this.tag=s.default.packet.symEncryptedAEADProtected,this.version=c,this.cipherAlgo=null,this.aeadAlgorithm="eax",this.aeadAlgo=null,this.chunkSizeByte=null,this.iv=null,this.encrypted=null,this.packets=null}r.default=f,f.prototype.read=async function(e){await n.default.parse(e,async e=>{if(await e.readByte()!==c)throw new Error("Invalid packet version.");4===i.default.aead_protect_version?(this.cipherAlgo=await e.readByte(),this.aeadAlgo=await e.readByte(),this.chunkSizeByte=await e.readByte()):this.aeadAlgo=s.default.aead.experimental_gcm;const t=a.default[s.default.read(s.default.aead,this.aeadAlgo)];this.iv=await e.readBytes(t.ivLength),this.encrypted=e.remainder()})},f.prototype.write=function(){return 4===i.default.aead_protect_version?o.default.concat([new Uint8Array([this.version,this.cipherAlgo,this.aeadAlgo,this.chunkSizeByte]),this.iv,this.encrypted]):o.default.concat([new Uint8Array([this.version]),this.iv,this.encrypted])},f.prototype.decrypt=async function(e,t,r){return 4!==i.default.aead_protect_version&&(this.cipherAlgo=s.default.write(s.default.symmetric,e)),await this.packets.read(await this.crypt("decrypt",t,n.default.clone(this.encrypted),r)),!0},f.prototype.encrypt=async function(e,t,r){this.cipherAlgo=s.default.write(s.default.symmetric,e),this.aeadAlgo=4===i.default.aead_protect_version?s.default.write(s.default.aead,this.aeadAlgorithm):s.default.aead.experimental_gcm;const n=a.default[s.default.read(s.default.aead,this.aeadAlgo)];this.iv=await a.default.random.getRandomBytes(n.ivLength),this.chunkSizeByte=i.default.aead_chunk_size_byte;const o=this.packets.write();this.encrypted=await this.crypt("encrypt",t,o,r)},f.prototype.crypt=async function(e,t,r,u){const c=s.default.read(s.default.symmetric,this.cipherAlgo),f=a.default[s.default.read(s.default.aead,this.aeadAlgo)],d=await f(c,t);if(4===i.default.aead_protect_version){const t="decrypt"===e?f.tagLength:0,a=2**(this.chunkSizeByte+6)+t,s=new ArrayBuffer(21),c=new Uint8Array(s,0,13),l=new Uint8Array(s),h=new DataView(s),p=new Uint8Array(s,5,8);c.set([192|this.tag,this.version,this.cipherAlgo,this.aeadAlgo,this.chunkSizeByte],0);let y=0,b=Promise.resolve(),m=0,g=0;const w=this.iv;return n.default.transformPair(r,async(r,s)=>{const _=n.default.getReader(r),v=new TransformStream({},{highWaterMark:u?o.default.getHardwareConcurrency()*2**(i.default.aead_chunk_size_byte+6):1/0,size:e=>e.length});n.default.pipe(v.readable,s);const k=n.default.getWriter(v.writable);try{for(;;){let r=await _.readBytes(a+t)||new Uint8Array;const n=r.subarray(r.length-t);let i,s;if(r=r.subarray(0,r.length-t),!y||r.length?(_.unshift(n),i=d[e](r,f.getNonce(w,p),c)):(h.setInt32(17,m),i=d[e](n,f.getNonce(w,p),l),s=!0),m+=r.length-t,g+=r.length-t,b=b.then(()=>i).then(async e=>{await k.ready,await k.write(e),g-=r.length}).catch(e=>k.abort(e)),(s||g>k.desiredSize)&&await b,s){await k.close();break}h.setInt32(9,++y)}}catch(A){await k.abort(A)}})}return d[e](await n.default.readToEnd(r),this.iv)}},{"../config":81,"../crypto":96,"../enums":115,"../util":154,"web-stream-tools":77}],140:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("web-stream-tools")),i=u(e("../config")),a=u(e("../crypto")),s=u(e("../enums")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}const c=1;function f(){this.tag=s.default.packet.symEncryptedIntegrityProtected,this.version=c,this.encrypted=null,this.modification=!1,this.packets=null}f.prototype.read=async function(e){await n.default.parse(e,async e=>{if(await e.readByte()!==c)throw new Error("Invalid packet version.");this.encrypted=e.remainder()})},f.prototype.write=function(){return o.default.concat([new Uint8Array([c]),this.encrypted])},f.prototype.encrypt=async function(e,t,r){let i=this.packets.write();r||(i=await n.default.readToEnd(i));const s=await a.default.getPrefixRandom(e),u=new Uint8Array([211,20]),c=o.default.concat([s,i,u]),f=await a.default.hash.sha1(n.default.passiveClone(c)),d=o.default.concat([c,f]);return this.encrypted=await a.default.cfb.encrypt(e,t,d,new Uint8Array(a.default.cipher[e].blockSize)),!0},f.prototype.decrypt=async function(e,t,r){r||(this.encrypted=await n.default.readToEnd(this.encrypted));const s=n.default.clone(this.encrypted),u=await a.default.cfb.decrypt(e,t,s,new Uint8Array(a.default.cipher[e].blockSize)),c=n.default.slice(n.default.passiveClone(u),-20),f=n.default.slice(u,0,-20),d=Promise.all([n.default.readToEnd(await a.default.hash.sha1(n.default.passiveClone(f))),n.default.readToEnd(c)]).then(([e,t])=>{if(!o.default.equalsUint8Array(e,t))throw new Error("Modification detected.");return new Uint8Array}),l=n.default.slice(f,a.default.cipher[e].blockSize+2);let h=n.default.slice(l,0,-2);return h=n.default.concat([h,n.default.fromAsync(()=>d)]),o.default.isStream(s)&&i.default.allow_unauthenticated_stream||(h=await n.default.readToEnd(h)),await this.packets.read(h),!0},r.default=f},{"../config":81,"../crypto":96,"../enums":115,"../util":154,"web-stream-tools":77}],141:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("../type/s2k")),i=u(e("../config")),a=u(e("../crypto")),s=u(e("../enums")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}function c(){this.tag=s.default.packet.symEncryptedSessionKey,this.version=i.default.aead_protect&&4===i.default.aead_protect_version?5:4,this.sessionKey=null,this.sessionKeyEncryptionAlgorithm=null,this.sessionKeyAlgorithm="aes256",this.aeadAlgorithm=s.default.read(s.default.aead,i.default.aead_mode),this.encrypted=null,this.s2k=null,this.iv=null}c.prototype.read=function(e){let t=0;this.version=e[t++];const r=s.default.read(s.default.symmetric,e[t++]);if(5===this.version&&(this.aeadAlgorithm=s.default.read(s.default.aead,e[t++])),this.s2k=new n.default,t+=this.s2k.read(e.subarray(t,e.length)),5===this.version){const r=a.default[this.aeadAlgorithm];this.iv=e.subarray(t,t+=r.ivLength)}5===this.version||t<e.length?(this.encrypted=e.subarray(t,e.length),this.sessionKeyEncryptionAlgorithm=r):this.sessionKeyAlgorithm=r},c.prototype.write=function(){const e=null===this.encrypted?this.sessionKeyAlgorithm:this.sessionKeyEncryptionAlgorithm;let t;return 5===this.version?t=o.default.concatUint8Array([new Uint8Array([this.version,s.default.write(s.default.symmetric,e),s.default.write(s.default.aead,this.aeadAlgorithm)]),this.s2k.write(),this.iv,this.encrypted]):(t=o.default.concatUint8Array([new Uint8Array([this.version,s.default.write(s.default.symmetric,e)]),this.s2k.write()]),null!==this.encrypted&&(t=o.default.concatUint8Array([t,this.encrypted]))),t},c.prototype.decrypt=async function(e){const t=null!==this.sessionKeyEncryptionAlgorithm?this.sessionKeyEncryptionAlgorithm:this.sessionKeyAlgorithm,r=a.default.cipher[t].keySize,n=await this.s2k.produce_key(e,r);if(5===this.version){const e=a.default[this.aeadAlgorithm],r=new Uint8Array([192|this.tag,this.version,s.default.write(s.default.symmetric,this.sessionKeyEncryptionAlgorithm),s.default.write(s.default.aead,this.aeadAlgorithm)]),i=await e(t,n);this.sessionKey=await i.decrypt(this.encrypted,this.iv,r)}else if(null!==this.encrypted){const e=await a.default.cfb.decrypt(t,n,this.encrypted,new Uint8Array(a.default.cipher[t].blockSize));this.sessionKeyAlgorithm=s.default.read(s.default.symmetric,e[0]),this.sessionKey=e.subarray(1,e.length)}else this.sessionKey=n;return!0},c.prototype.encrypt=async function(e){const t=null!==this.sessionKeyEncryptionAlgorithm?this.sessionKeyEncryptionAlgorithm:this.sessionKeyAlgorithm;this.sessionKeyEncryptionAlgorithm=t,this.s2k=new n.default,this.s2k.salt=await a.default.random.getRandomBytes(8);const r=a.default.cipher[t].keySize,i=await this.s2k.produce_key(e,r);if(null===this.sessionKey&&(this.sessionKey=await a.default.generateSessionKey(this.sessionKeyAlgorithm)),5===this.version){const e=a.default[this.aeadAlgorithm];this.iv=await a.default.random.getRandomBytes(e.ivLength);const r=new Uint8Array([192|this.tag,this.version,s.default.write(s.default.symmetric,this.sessionKeyEncryptionAlgorithm),s.default.write(s.default.aead,this.aeadAlgorithm)]),n=await e(t,i);this.encrypted=await n.encrypt(this.sessionKey,this.iv,r)}else{const e=new Uint8Array([s.default.write(s.default.symmetric,this.sessionKeyAlgorithm)]),r=o.default.concatUint8Array([e,this.sessionKey]);this.encrypted=await a.default.cfb.encrypt(t,i,r,new Uint8Array(a.default.cipher[t].blockSize))}return!0},c.prototype.postCloneTypeFix=function(){this.s2k=n.default.fromClone(this.s2k)},r.default=c},{"../config":81,"../crypto":96,"../enums":115,"../type/s2k":153,"../util":154}],142:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=u(e("web-stream-tools")),i=u(e("../config")),a=u(e("../crypto")),s=u(e("../enums")),o=u(e("../util"));function u(e){return e&&e.__esModule?e:{default:e}}function c(){this.tag=s.default.packet.symmetricallyEncrypted,this.encrypted=null,this.packets=null,this.ignore_mdc_error=i.default.ignore_mdc_error}c.prototype.read=function(e){this.encrypted=e},c.prototype.write=function(){return this.encrypted},c.prototype.decrypt=async function(e,t){this.encrypted=await n.default.readToEnd(this.encrypted);const r=await a.default.cfb.decrypt(e,t,this.encrypted.subarray(a.default.cipher[e].blockSize+2),this.encrypted.subarray(2,a.default.cipher[e].blockSize+2));if(!this.ignore_mdc_error)throw new Error("Decryption failed due to missing MDC.");return await this.packets.read(r),!0},c.prototype.encrypt=async function(e,t){const r=this.packets.write(),n=await a.default.getPrefixRandom(e),i=await a.default.cfb.encrypt(e,t,n,new Uint8Array(a.default.cipher[e].blockSize)),s=await a.default.cfb.encrypt(e,t,r,i.subarray(2));return this.encrypted=o.default.concatUint8Array([i,s]),!0},r.default=c},{"../config":81,"../crypto":96,"../enums":115,"../util":154,"web-stream-tools":77}],143:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../enums"),a=(n=i)&&n.__esModule?n:{default:n};function s(){this.tag=a.default.packet.trust}s.prototype.read=function(){},r.default=s},{"../enums":115}],144:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=s(e("./packet")),i=s(e("../enums")),a=s(e("../util"));function s(e){return e&&e.__esModule?e:{default:e}}function o(){this.tag=i.default.packet.userAttribute,this.attributes=[]}o.prototype.read=function(e){let t=0;for(;t<e.length;){const r=n.default.readSimpleLength(e.subarray(t,e.length));t+=r.offset,this.attributes.push(a.default.Uint8Array_to_str(e.subarray(t,t+r.len))),t+=r.len}},o.prototype.write=function(){const e=[];for(let t=0;t<this.attributes.length;t++)e.push(n.default.writeSimpleLength(this.attributes[t].length)),e.push(a.default.str_to_Uint8Array(this.attributes[t]));return a.default.concatUint8Array(e)},o.prototype.equals=function(e){return!!(e&&e instanceof o)&&this.attributes.every(function(t,r){return t===e.attributes[r]})},r.default=o},{"../enums":115,"../util":154,"./packet":131}],145:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("../enums")),i=a(e("../util"));function a(e){return e&&e.__esModule?e:{default:e}}function s(){this.tag=n.default.packet.userid,this.userid="",this.name="",this.email="",this.comment=""}s.prototype.read=function(e){this.parse(i.default.decode_utf8(e))},s.prototype.parse=function(e){try{Object.assign(this,i.default.parseUserId(e))}catch(t){}this.userid=e},s.prototype.write=function(){return i.default.encode_utf8(this.userid)},s.prototype.format=function(e){i.default.isString(e)&&(e=i.default.parseUserId(e)),Object.assign(this,e),this.userid=i.default.formatUserId(e)},r.default=s},{"../enums":115,"../util":154}],146:[function(e,t,r){(function(t){"use strict";var r,n=e("./util"),i=(r=n)&&r.__esModule?r:{default:r};if("undefined"!=typeof window)try{void 0===window.fetch&&e("whatwg-fetch"),void 0===Array.prototype.fill&&e("core-js/fn/array/fill"),void 0===Array.prototype.find&&e("core-js/fn/array/find"),void 0===Array.prototype.includes&&e("core-js/fn/array/includes"),void 0===Array.from&&e("core-js/fn/array/from"),e("core-js/fn/promise"),void 0===Uint8Array.from&&e("core-js/fn/typed/uint8-array"),void 0===String.prototype.repeat&&e("core-js/fn/string/repeat"),"undefined"==typeof Symbol&&e("core-js/fn/symbol"),void 0===Object.assign&&e("core-js/fn/object/assign")}catch(a){}if("undefined"==typeof TransformStream&&e("@mattiasbuelens/web-streams-polyfill"),"undefined"==typeof TextEncoder){const e=i.default.nodeRequire("util")||{};t.TextEncoder=e.TextEncoder,t.TextDecoder=e.TextDecoder}if("undefined"==typeof TextEncoder){const r=e("text-encoding-utf-8");t.TextEncoder=r.TextEncoder,t.TextDecoder=r.TextDecoder}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"./util":154,"@mattiasbuelens/web-streams-polyfill":1,"core-js/fn/array/fill":"core-js/fn/array/fill","core-js/fn/array/find":"core-js/fn/array/find","core-js/fn/array/from":"core-js/fn/array/from","core-js/fn/array/includes":"core-js/fn/array/includes","core-js/fn/object/assign":"core-js/fn/object/assign","core-js/fn/promise":"core-js/fn/promise","core-js/fn/string/repeat":"core-js/fn/string/repeat","core-js/fn/symbol":"core-js/fn/symbol","core-js/fn/typed/uint8-array":"core-js/fn/typed/uint8-array","text-encoding-utf-8":74,"whatwg-fetch":"whatwg-fetch"}],147:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.Signature=o,r.readArmored=async function(e){return u((await n.default.decode(e)).data)},r.read=u;var n=s(e("./encoding/armor")),i=s(e("./packet")),a=s(e("./enums"));function s(e){return e&&e.__esModule?e:{default:e}}function o(e){if(!(this instanceof o))return new o(e);this.packets=e||new i.default.List}async function u(e){const t=new i.default.List;return await t.read(e),new o(t)}o.prototype.armor=function(){return n.default.encode(a.default.armor.signature,this.packets.write())}},{"./encoding/armor":113,"./enums":115,"./packet":127}],148:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../util"),a=(n=i)&&n.__esModule?n:{default:n};function s(e){e=void 0===e?new Uint8Array([]):a.default.isString(e)?a.default.str_to_Uint8Array(e):new Uint8Array(e),this.data=e}s.prototype.read=function(e){if(e.length>=1){const t=e[0];if(e.length>=1+t)return this.data=e.subarray(1,1+t),1+this.data.length}throw new Error("Invalid symmetric key")},s.prototype.write=function(){return a.default.concatUint8Array([new Uint8Array([this.data.length]),this.data])},s.fromClone=function(e){return new s(e.data)},r.default=s},{"../util":154}],149:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../enums.js"),a=(n=i)&&n.__esModule?n:{default:n};function s(e){e&&2===e.length?(this.hash=e[0],this.cipher=e[1]):(this.hash=a.default.hash.sha1,this.cipher=a.default.symmetric.aes128)}s.prototype.read=function(e){if(e.length<4||3!==e[0]||1!==e[1])throw new Error("Cannot read KDFParams");return this.hash=e[2],this.cipher=e[3],4},s.prototype.write=function(){return new Uint8Array([3,1,this.hash,this.cipher])},s.fromClone=function(e){return new s([e.hash,e.cipher])},r.default=s},{"../enums.js":115}],150:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n,i=e("../util.js"),a=(n=i)&&n.__esModule?n:{default:n};function s(){this.bytes=""}s.prototype.read=function(e){this.bytes=a.default.Uint8Array_to_str(e.subarray(0,8))},s.prototype.write=function(){return a.default.str_to_Uint8Array(this.bytes)},s.prototype.toHex=function(){return a.default.str_to_hex(this.bytes)},s.prototype.equals=function(e,t=!1){return t&&(e.isWildcard()||this.isWildcard())||this.bytes===e.bytes},s.prototype.isNull=function(){return""===this.bytes},s.prototype.isWildcard=function(){return/^0+$/.test(this.toHex())},s.mapToHex=function(e){return e.toHex()},s.fromClone=function(e){const t=new s;return t.bytes=e.bytes,t},s.fromId=function(e){const t=new s;return t.read(a.default.hex_to_Uint8Array(e)),t},s.wildcard=function(){const e=new s;return e.read(new Uint8Array(8)),e},r.default=s},{"../util.js":154}],151:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("bn.js")),i=a(e("../util"));function a(e){return e&&e.__esModule?e:{default:e}}function s(e){e instanceof s?this.data=e.data:n.default.isBN(e)?this.fromBN(e):i.default.isUint8Array(e)?this.fromUint8Array(e):i.default.isString(e)?this.fromString(e):this.data=null}s.prototype.read=function(e,t="be"){i.default.isString(e)&&(e=i.default.str_to_Uint8Array(e));const r=(e[0]<<8|e[1])+7>>>3,n=e.subarray(2,2+r);return this.fromUint8Array(n,t),2+r},s.prototype.write=function(e,t){return i.default.Uint8Array_to_MPI(this.toUint8Array(e,t))},s.prototype.bitLength=function(){return 8*(this.data.length-1)+i.default.nbits(this.data[0])},s.prototype.byteLength=function(){return this.data.length},s.prototype.toUint8Array=function(e,t){e=e||"be",t=t||this.data.length;const r=new Uint8Array(t),n=t-this.data.length;if(n<0)throw new Error("Payload is too large.");return r.set(this.data,n),"le"===e&&r.reverse(),r},s.prototype.fromUint8Array=function(e,t="be"){this.data=new Uint8Array(e.length),this.data.set(e),"le"===t&&this.data.reverse()},s.prototype.toString=function(){return i.default.Uint8Array_to_str(this.toUint8Array())},s.prototype.fromString=function(e,t="be"){this.fromUint8Array(i.default.str_to_Uint8Array(e),t)},s.prototype.toBN=function(){return new n.default(this.toUint8Array())},s.prototype.fromBN=function(e){this.data=e.toArrayLike(Uint8Array)},s.fromClone=function(e){return new s(e.data)},r.default=s},{"../util":154,"bn.js":17}],152:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=a(e("../util")),i=a(e("../enums"));function a(e){return e&&e.__esModule?e:{default:e}}function s(e){if(e instanceof s)this.oid=e.oid;else if(n.default.isArray(e)||n.default.isUint8Array(e)){if(6===(e=new Uint8Array(e))[0]){if(e[1]!==e.length-2)throw new Error("Length mismatch in DER encoded oid");e=e.subarray(2)}this.oid=e}else this.oid=""}s.prototype.read=function(e){if(e.length>=1){const t=e[0];if(e.length>=1+t)return this.oid=e.subarray(1,1+t),1+this.oid.length}throw new Error("Invalid oid")},s.prototype.write=function(){return n.default.concatUint8Array([new Uint8Array([this.oid.length]),this.oid])},s.prototype.toHex=function(){return n.default.Uint8Array_to_hex(this.oid)},s.prototype.getName=function(){const e=this.toHex();if(i.default.curve[e])return i.default.write(i.default.curve,e);throw new Error("Unknown curve object identifier.")},s.fromClone=function(e){return new s(e.oid)},r.default=s},{"../enums":115,"../util":154}],153:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=o(e("../config")),i=o(e("../crypto")),a=o(e("../enums.js")),s=o(e("../util.js"));function o(e){return e&&e.__esModule?e:{default:e}}function u(){this.algorithm="sha256",this.type="iterated",this.c=n.default.s2k_iteration_count_byte,this.salt=null}u.prototype.get_count=function(){return 16+(15&this.c)<<6+(this.c>>4)},u.prototype.read=function(e){let t=0;switch(this.type=a.default.read(a.default.s2k,e[t++]),this.algorithm=a.default.read(a.default.hash,e[t++]),this.type){case"simple":break;case"salted":this.salt=e.subarray(t,t+8),t+=8;break;case"iterated":this.salt=e.subarray(t,t+8),t+=8,this.c=e[t++];break;case"gnu":if("GNU"!==s.default.Uint8Array_to_str(e.subarray(t,3)))throw new Error("Unknown s2k type.");{t+=3;const r=1e3+e[t++];if(1001!==r)throw new Error("Unknown s2k gnu protection mode.");this.type=r}break;default:throw new Error("Unknown s2k type.")}return t},u.prototype.write=function(){const e=[new Uint8Array([a.default.write(a.default.s2k,this.type),a.default.write(a.default.hash,this.algorithm)])];switch(this.type){case"simple":break;case"salted":e.push(this.salt);break;case"iterated":e.push(this.salt),e.push(new Uint8Array([this.c]));break;case"gnu":throw new Error("GNU s2k type not supported.");default:throw new Error("Unknown s2k type.")}return s.default.concatUint8Array(e)},u.prototype.produce_key=async function(e,t){async function r(t,r){const n=a.default.write(a.default.hash,r.algorithm);switch(r.type){case"simple":return i.default.hash.digest(n,s.default.concatUint8Array([t,e]));case"salted":return i.default.hash.digest(n,s.default.concatUint8Array([t,r.salt,e]));case"iterated":{const a=r.get_count(),o=s.default.concatUint8Array([r.salt,e]),u=o.length,c=new Uint8Array(t.length+a+u);c.set(t);for(let e=t.length;e<a;e+=u)c.set(o,e);return i.default.hash.digest(n,c.subarray(0,t.length+a))}case"gnu":throw new Error("GNU s2k type not supported.");default:throw new Error("Unknown s2k type.")}}e=s.default.encode_utf8(e);const n=[];let o=0;const u=new Uint8Array(t);for(let i=0;i<t;i++)u[i]=0;let c=0;for(;o<t;){const e=await r(u.subarray(0,c),this);n.push(e),o+=e.length,c++}return s.default.concatUint8Array(n).subarray(0,t)},u.fromClone=function(e){const t=new u;return t.algorithm=e.algorithm,t.type=e.type,t.c=e.c,t.salt=e.salt,t},r.default=u},{"../config":81,"../crypto":96,"../enums.js":115,"../util.js":154}],154:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=function(){return function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var r=[],n=!0,i=!1,a=void 0;try{for(var s,o=e[Symbol.iterator]();!(n=(s=o.next()).done)&&(r.push(s.value),!t||r.length!==t);n=!0);}catch(u){i=!0,a=u}finally{try{!n&&o.return&&o.return()}finally{if(i)throw a}}return r}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),i=c(e("address-rfc2822")),a=c(e("web-stream-tools")),s=c(e("./config")),o=c(e("./util")),u=c(e("./encoding/base64"));function c(e){return e&&e.__esModule?e:{default:e}}r.default={isString:function(e){return"string"==typeof e||String.prototype.isPrototypeOf(e)},isArray:function(e){return Array.prototype.isPrototypeOf(e)},isUint8Array:a.default.isUint8Array,isStream:a.default.isStream,getTransferables:function(e,t){const r=[];return o.default.collectTransferables(e,r,t),r.length?r:void 0},collectTransferables:function(e,t,r){e&&(o.default.isUint8Array(e)?r&&-1===t.indexOf(e.buffer)&&!(-1!==navigator.userAgent.indexOf("Version/11.1")||(navigator.userAgent.match(/Chrome\/(\d+)/)||[])[1]<56&&-1===navigator.userAgent.indexOf("Edge"))&&t.push(e.buffer):Object.prototype.isPrototypeOf(e)&&Object.entries(e).forEach(([n,i])=>{if(o.default.isStream(i))if(i.locked)e[n]=null;else{const r=a.default.transformPair(i,async i=>{const s=a.default.getReader(i);var u=new MessageChannel;const c=u.port1,f=u.port2;c.onmessage=async function({data:{action:e}}){if("read"===e){const e=await s.read();c.postMessage(e,o.default.getTransferables(e,!0))}else"cancel"===e&&c.postMessage(await r.cancel())},e[n]=f,t.push(f)})}else{if("[object MessagePort]"===Object.prototype.toString.call(i))throw new Error("Can't transfer the same stream twice.");o.default.collectTransferables(i,t,r)}}))},restoreStreams:function(e){return Object.prototype.isPrototypeOf(e)&&!Uint8Array.prototype.isPrototypeOf(e)&&Object.entries(e).forEach(([t,r])=>{"[object MessagePort]"!==Object.prototype.toString.call(r)?o.default.restoreStreams(r):e[t]=new ReadableStream({pull:e=>new Promise(t=>{r.onmessage=(r=>{var n=r.data;const i=n.done,a=n.value;i?e.close():e.enqueue(a),t()}),r.postMessage({action:"read"})}),cancel:()=>new Promise(e=>{r.onmessage=e,r.postMessage({action:"cancel"})})},{highWaterMark:0})}),e},readNumber:function(e){let t=0;for(let r=0;r<e.length;r++)t+=256**r*e[e.length-1-r];return t},writeNumber:function(e,t){const r=new Uint8Array(t);for(let n=0;n<t;n++)r[n]=e>>8*(t-n-1)&255;return r},readDate:function(e){const t=o.default.readNumber(e);return new Date(1e3*t)},writeDate:function(e){const t=Math.floor(e.getTime()/1e3);return o.default.writeNumber(t,4)},normalizeDate:function(e=Date.now()){return null===e||e===1/0?e:new Date(1e3*Math.floor(+e/1e3))},str_to_hex:function(e){if(null===e)return"";const t=[],r=e.length;let n,i=0;for(;i<r;){for(n=e.charCodeAt(i++).toString(16);n.length<2;)n="0"+n;t.push(""+n)}return t.join("")},hex_to_str:function(e){let t="";for(let r=0;r<e.length;r+=2)t+=String.fromCharCode(parseInt(e.substr(r,2),16));return t},Uint8Array_to_MPI:function(e){const t=8*(e.length-1)+o.default.nbits(e[0]),r=Uint8Array.from([(65280&t)>>8,255&t]);return o.default.concatUint8Array([r,e])},b64_to_Uint8Array:function(e){return u.default.decode(e.replace(/-/g,"+").replace(/_/g,"/"))},Uint8Array_to_b64:function(e,t){return u.default.encode(e,t).replace(/(\n)/g,"")},hex_to_Uint8Array:function(e){const t=new Uint8Array(e.length>>1);for(let r=0;r<e.length>>1;r++)t[r]=parseInt(e.substr(r<<1,2),16);return t},Uint8Array_to_hex:function(e){const t=[],r=e.length;let n,i=0;for(;i<r;){for(n=e[i++].toString(16);n.length<2;)n="0"+n;t.push(""+n)}return t.join("")},str_to_Uint8Array:function(e){return a.default.transform(e,e=>{if(!o.default.isString(e))throw new Error("str_to_Uint8Array: Data must be in the form of a string");const t=new Uint8Array(e.length);for(let r=0;r<e.length;r++)t[r]=e.charCodeAt(r);return t})},Uint8Array_to_str:function(e){const t=[],r=(e=new Uint8Array(e)).length;for(let n=0;n<r;n+=16384)t.push(String.fromCharCode.apply(String,e.subarray(n,n+16384<r?n+16384:r)));return t.join("")},encode_utf8:function(e){const t=new TextEncoder("utf-8");function r(e,r=!1){return t.encode(e,{stream:!r})}return a.default.transform(e,r,()=>r("",!0))},decode_utf8:function(e){const t=new TextDecoder("utf-8");function r(e,r=!1){return t.decode(e,{stream:!r})}return a.default.transform(e,r,()=>r(new Uint8Array,!0))},concat:a.default.concat,concatUint8Array:a.default.concatUint8Array,equalsUint8Array:function(e,t){if(!o.default.isUint8Array(e)||!o.default.isUint8Array(t))throw new Error("Data must be in the form of a Uint8Array");if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++)if(e[r]!==t[r])return!1;return!0},write_checksum:function(e){let t=0;for(let r=0;r<e.length;r++)t=t+e[r]&65535;return o.default.writeNumber(t,2)},print_debug:function(e){s.default.debug&&console.log(e)},print_debug_hexarray_dump:function(e,t){s.default.debug&&(e+=": "+o.default.Uint8Array_to_hex(t),console.log(e))},print_debug_hexstr_dump:function(e,t){s.default.debug&&(e+=o.default.str_to_hex(t),console.log(e))},print_debug_error:function(e){s.default.debug&&console.error(e)},print_entire_stream:function(e,t,r){a.default.readToEnd(a.default.clone(t),r).then(t=>{console.log(e+": ",t)})},getLeftNBits:function(e,t){const r=t%8;if(0===r)return e.subarray(0,t/8);const n=(t-r)/8+1,i=e.subarray(0,n);return o.default.shiftRight(i,8-r)},nbits:function(e){let t=1,r=e>>>16;return 0!==r&&(e=r,t+=16),0!==(r=e>>8)&&(e=r,t+=8),0!==(r=e>>4)&&(e=r,t+=4),0!==(r=e>>2)&&(e=r,t+=2),0!==(r=e>>1)&&(e=r,t+=1),t},double:function(e){const t=new Uint8Array(e.length),r=e.length-1;for(let n=0;n<r;n++)t[n]=e[n]<<1^e[n+1]>>7;return t[r]=e[r]<<1^135*(e[0]>>7),t},shiftRight:function(e,t){if(t)for(let r=e.length-1;r>=0;r--)e[r]>>=t,r>0&&(e[r]|=e[r-1]<<8-t);return e},getWebCrypto:function(){if(s.default.use_native)return"undefined"!=typeof window&&window.crypto&&window.crypto.subtle},getWebCryptoAll:function(){if(s.default.use_native&&"undefined"!=typeof window){if(window.crypto)return window.crypto.subtle||window.crypto.webkitSubtle;if(window.msCrypto)return window.msCrypto.subtle}},detectNode:function(){return"undefined"==typeof window},nodeRequire:function(t){if(o.default.detectNode())return e(t)},getNodeCrypto:function(){if(s.default.use_native)return o.default.nodeRequire("crypto")},getNodeZlib:function(){if(s.default.use_native)return o.default.nodeRequire("zlib")},getNodeBuffer:function(){return(o.default.nodeRequire("buffer")||{}).Buffer},getNodeStream:function(){return(o.default.nodeRequire("stream")||{}).Readable},getHardwareConcurrency:function(){if(o.default.detectNode()){return o.default.nodeRequire("os").cpus().length}return navigator.hardwareConcurrency||1},isEmailAddress:function(e){if(!o.default.isString(e))return!1;return/^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+([a-zA-Z]{2,}|xn--[a-zA-Z\-0-9]+)))$/.test(e)},formatUserId:function(e){if(e.name&&!o.default.isString(e.name)||e.email&&!o.default.isEmailAddress(e.email))throw new Error("Invalid user id format");return new i.default.Address(e.name,e.email,e.comment).format()},parseUserId:function(e){if(e.length>s.default.max_userid_length)throw new Error("User id string is too long");try{var t=i.default.parse(e),r=n(t,1)[0];return{name:r.phrase,email:r.address,comment:r.comment.replace(/^\(|\)$/g,"")}}catch(a){throw new Error("Invalid user id format")}},canonicalizeEOL:function(e){return a.default.transform(o.default.nativeEOL(e),e=>e.replace(/\r/g,"\n").replace(/\n/g,"\r\n"))},nativeEOL:function(e){let t="";return a.default.transform(e,e=>("\r"===(e=t+e)[e.length-1]?(t="\r",e=e.slice(0,-1)):t="",e.replace(/\r\n/g,"\n")),()=>t)},removeTrailingSpaces:function(e){return e.split("\n").map(e=>{let t=e.length-1;for(;t>=0&&(" "===e[t]||"\t"===e[t]);t--);return e.substr(0,t+1)}).join("\n")},encodeZBase32:function(e){if(0===e.length)return"";let t=e[0],r=1,n=8,i="";for(;n>0||r<e.length;){if(n<5)if(r<e.length)t<<=8,t|=255&e[r++],n+=8;else{const e=5-n;t<<=e,n+=e}i+="ybndrfg8ejkmcpqxot1uwisza345h769"[31&t>>(n-=5)]}return i}}},{"./config":81,"./encoding/base64":114,"./util":154,"address-rfc2822":2,"web-stream-tools":77}],155:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=function(){return function(e,t){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return function(e,t){var r=[],n=!0,i=!1,a=void 0;try{for(var s,o=e[Symbol.iterator]();!(n=(s=o.next()).done)&&(r.push(s.value),!t||r.length!==t);n=!0);}catch(u){i=!0,a=u}finally{try{!n&&o.return&&o.return()}finally{if(i)throw a}}return r}(e,t);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),i=o(e("./util")),a=o(e("./crypto")),s=function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.prototype.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t}(e("./key"));function o(e){return e&&e.__esModule?e:{default:e}}function u(){this._fetch="undefined"!=typeof window?window.fetch:e("node-fetch")}u.prototype.lookup=async function(e){const t=this._fetch;if(!e.email)throw new Error("You must provide an email parameter!");if(!i.default.isEmailAddress(e.email))throw new Error("Invalid e-mail address.");var r=/(.*)@(.*)/.exec(e.email),o=n(r,3);const u=o[1];return t(`https://${o[2]}/.well-known/openpgpkey/hu/${i.default.encodeZBase32(await a.default.hash.sha1(i.default.str_to_Uint8Array(u.toLowerCase())))}`).then(function(e){if(200===e.status)return e.arrayBuffer()}).then(function(t){if(t){const r=new Uint8Array(t);return e.rawBytes?r:s.read(r)}})},r.default=u},{"./crypto":96,"./key":118,"./util":154,"node-fetch":"node-fetch"}],156:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=o(e("../util.js")),i=o(e("../config")),a=o(e("../crypto")),s=o(e("../packet"));function o(e){return e&&e.__esModule?e:{default:e}}function u({path:e="openpgp.worker.min.js",n:t=1,workers:r=[],config:n}={}){const i=e=>t=>{const r=t.data;switch(r.event){case"method-return":if(r.err){const e=new Error(r.err);e.workerStack=r.stack,this.tasks[r.id].reject(e)}else this.tasks[r.id].resolve(r.data);delete this.tasks[r.id],this.workers[e].requests--;break;case"request-seed":this.seedRandom(e,r.amount);break;default:throw new Error("Unknown Worker Event.")}};if(r.length)this.workers=r;else for(this.workers=[];this.workers.length<t;)this.workers.push(new Worker(e));let a=0;this.workers.forEach(e=>{e.requests=0,e.onmessage=i(a++),e.onerror=(e=>{throw new Error("Unhandled error in openpgp worker: "+e.message+" ("+e.filename+":"+e.lineno+")")}),n&&e.postMessage({event:"configure",config:n})}),this.tasks={},this.currentID=0}u.prototype.getID=function(){return this.currentID++},u.prototype.seedRandom=async function(e,t){const r=await a.default.random.getRandomBytes(t);this.workers[e].postMessage({event:"seed-random",buf:r},n.default.getTransferables(r,!0))},u.prototype.terminate=function(){this.workers.forEach(e=>{e.terminate()})},u.prototype.delegate=function(e,t){const r=this.getID(),a=this.workers.map(e=>e.requests),o=Math.min(...a);let u=0;for(;u<this.workers.length&&this.workers[u].requests!==o;u++);return new Promise((a,o)=>{this.workers[u].postMessage({id:r,event:e,options:s.default.clone.clonePackets(t)},n.default.getTransferables(t,i.default.zero_copy)),this.workers[u].requests++,this.tasks[r]={resolve:t=>a(s.default.clone.parseClonedPackets(n.default.restoreStreams(t),e)),reject:o}})},r.default=u},{"../config":81,"../crypto":96,"../packet":127,"../util.js":154}]},{},[117])(117)});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],39:[function(require,module,exports){
'use strict';

/* !
 * Chai - pathval utility
 * Copyright(c) 2012-2014 Jake Luer <jake@alogicalparadox.com>
 * @see https://github.com/logicalparadox/filtr
 * MIT Licensed
 */

/**
 * ### .hasProperty(object, name)
 *
 * This allows checking whether an object has own
 * or inherited from prototype chain named property.
 *
 * Basically does the same thing as the `in`
 * operator but works properly with null/undefined values
 * and other primitives.
 *
 *     var obj = {
 *         arr: ['a', 'b', 'c']
 *       , str: 'Hello'
 *     }
 *
 * The following would be the results.
 *
 *     hasProperty(obj, 'str');  // true
 *     hasProperty(obj, 'constructor');  // true
 *     hasProperty(obj, 'bar');  // false
 *
 *     hasProperty(obj.str, 'length'); // true
 *     hasProperty(obj.str, 1);  // true
 *     hasProperty(obj.str, 5);  // false
 *
 *     hasProperty(obj.arr, 'length');  // true
 *     hasProperty(obj.arr, 2);  // true
 *     hasProperty(obj.arr, 3);  // false
 *
 * @param {Object} object
 * @param {String|Symbol} name
 * @returns {Boolean} whether it exists
 * @namespace Utils
 * @name hasProperty
 * @api public
 */

function hasProperty(obj, name) {
  if (typeof obj === 'undefined' || obj === null) {
    return false;
  }

  // The `in` operator does not work with primitives.
  return name in Object(obj);
}

/* !
 * ## parsePath(path)
 *
 * Helper function used to parse string object
 * paths. Use in conjunction with `internalGetPathValue`.
 *
 *      var parsed = parsePath('myobject.property.subprop');
 *
 * ### Paths:
 *
 * * Can be infinitely deep and nested.
 * * Arrays are also valid using the formal `myobject.document[3].property`.
 * * Literal dots and brackets (not delimiter) must be backslash-escaped.
 *
 * @param {String} path
 * @returns {Object} parsed
 * @api private
 */

function parsePath(path) {
  var str = path.replace(/([^\\])\[/g, '$1.[');
  var parts = str.match(/(\\\.|[^.]+?)+/g);
  return parts.map(function mapMatches(value) {
    var regexp = /^\[(\d+)\]$/;
    var mArr = regexp.exec(value);
    var parsed = null;
    if (mArr) {
      parsed = { i: parseFloat(mArr[1]) };
    } else {
      parsed = { p: value.replace(/\\([.\[\]])/g, '$1') };
    }

    return parsed;
  });
}

/* !
 * ## internalGetPathValue(obj, parsed[, pathDepth])
 *
 * Helper companion function for `.parsePath` that returns
 * the value located at the parsed address.
 *
 *      var value = getPathValue(obj, parsed);
 *
 * @param {Object} object to search against
 * @param {Object} parsed definition from `parsePath`.
 * @param {Number} depth (nesting level) of the property we want to retrieve
 * @returns {Object|Undefined} value
 * @api private
 */

function internalGetPathValue(obj, parsed, pathDepth) {
  var temporaryValue = obj;
  var res = null;
  pathDepth = (typeof pathDepth === 'undefined' ? parsed.length : pathDepth);

  for (var i = 0; i < pathDepth; i++) {
    var part = parsed[i];
    if (temporaryValue) {
      if (typeof part.p === 'undefined') {
        temporaryValue = temporaryValue[part.i];
      } else {
        temporaryValue = temporaryValue[part.p];
      }

      if (i === (pathDepth - 1)) {
        res = temporaryValue;
      }
    }
  }

  return res;
}

/* !
 * ## internalSetPathValue(obj, value, parsed)
 *
 * Companion function for `parsePath` that sets
 * the value located at a parsed address.
 *
 *  internalSetPathValue(obj, 'value', parsed);
 *
 * @param {Object} object to search and define on
 * @param {*} value to use upon set
 * @param {Object} parsed definition from `parsePath`
 * @api private
 */

function internalSetPathValue(obj, val, parsed) {
  var tempObj = obj;
  var pathDepth = parsed.length;
  var part = null;
  // Here we iterate through every part of the path
  for (var i = 0; i < pathDepth; i++) {
    var propName = null;
    var propVal = null;
    part = parsed[i];

    // If it's the last part of the path, we set the 'propName' value with the property name
    if (i === (pathDepth - 1)) {
      propName = typeof part.p === 'undefined' ? part.i : part.p;
      // Now we set the property with the name held by 'propName' on object with the desired val
      tempObj[propName] = val;
    } else if (typeof part.p !== 'undefined' && tempObj[part.p]) {
      tempObj = tempObj[part.p];
    } else if (typeof part.i !== 'undefined' && tempObj[part.i]) {
      tempObj = tempObj[part.i];
    } else {
      // If the obj doesn't have the property we create one with that name to define it
      var next = parsed[i + 1];
      // Here we set the name of the property which will be defined
      propName = typeof part.p === 'undefined' ? part.i : part.p;
      // Here we decide if this property will be an array or a new object
      propVal = typeof next.p === 'undefined' ? [] : {};
      tempObj[propName] = propVal;
      tempObj = tempObj[propName];
    }
  }
}

/**
 * ### .getPathInfo(object, path)
 *
 * This allows the retrieval of property info in an
 * object given a string path.
 *
 * The path info consists of an object with the
 * following properties:
 *
 * * parent - The parent object of the property referenced by `path`
 * * name - The name of the final property, a number if it was an array indexer
 * * value - The value of the property, if it exists, otherwise `undefined`
 * * exists - Whether the property exists or not
 *
 * @param {Object} object
 * @param {String} path
 * @returns {Object} info
 * @namespace Utils
 * @name getPathInfo
 * @api public
 */

function getPathInfo(obj, path) {
  var parsed = parsePath(path);
  var last = parsed[parsed.length - 1];
  var info = {
    parent: parsed.length > 1 ? internalGetPathValue(obj, parsed, parsed.length - 1) : obj,
    name: last.p || last.i,
    value: internalGetPathValue(obj, parsed),
  };
  info.exists = hasProperty(info.parent, info.name);

  return info;
}

/**
 * ### .getPathValue(object, path)
 *
 * This allows the retrieval of values in an
 * object given a string path.
 *
 *     var obj = {
 *         prop1: {
 *             arr: ['a', 'b', 'c']
 *           , str: 'Hello'
 *         }
 *       , prop2: {
 *             arr: [ { nested: 'Universe' } ]
 *           , str: 'Hello again!'
 *         }
 *     }
 *
 * The following would be the results.
 *
 *     getPathValue(obj, 'prop1.str'); // Hello
 *     getPathValue(obj, 'prop1.att[2]'); // b
 *     getPathValue(obj, 'prop2.arr[0].nested'); // Universe
 *
 * @param {Object} object
 * @param {String} path
 * @returns {Object} value or `undefined`
 * @namespace Utils
 * @name getPathValue
 * @api public
 */

function getPathValue(obj, path) {
  var info = getPathInfo(obj, path);
  return info.value;
}

/**
 * ### .setPathValue(object, path, value)
 *
 * Define the value in an object at a given string path.
 *
 * ```js
 * var obj = {
 *     prop1: {
 *         arr: ['a', 'b', 'c']
 *       , str: 'Hello'
 *     }
 *   , prop2: {
 *         arr: [ { nested: 'Universe' } ]
 *       , str: 'Hello again!'
 *     }
 * };
 * ```
 *
 * The following would be acceptable.
 *
 * ```js
 * var properties = require('tea-properties');
 * properties.set(obj, 'prop1.str', 'Hello Universe!');
 * properties.set(obj, 'prop1.arr[2]', 'B');
 * properties.set(obj, 'prop2.arr[0].nested.value', { hello: 'universe' });
 * ```
 *
 * @param {Object} object
 * @param {String} path
 * @param {Mixed} value
 * @api private
 */

function setPathValue(obj, path, val) {
  var parsed = parsePath(path);
  internalSetPathValue(obj, val, parsed);
  return obj;
}

module.exports = {
  hasProperty: hasProperty,
  getPathInfo: getPathInfo,
  getPathValue: getPathValue,
  setPathValue: setPathValue,
};

},{}],40:[function(require,module,exports){
(function (global){
(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.typeDetect = factory());
}(this, (function () { 'use strict';

/* !
 * type-detect
 * Copyright(c) 2013 jake luer <jake@alogicalparadox.com>
 * MIT Licensed
 */
var promiseExists = typeof Promise === 'function';

/* eslint-disable no-undef */
var globalObject = typeof self === 'object' ? self : global; // eslint-disable-line id-blacklist

var symbolExists = typeof Symbol !== 'undefined';
var mapExists = typeof Map !== 'undefined';
var setExists = typeof Set !== 'undefined';
var weakMapExists = typeof WeakMap !== 'undefined';
var weakSetExists = typeof WeakSet !== 'undefined';
var dataViewExists = typeof DataView !== 'undefined';
var symbolIteratorExists = symbolExists && typeof Symbol.iterator !== 'undefined';
var symbolToStringTagExists = symbolExists && typeof Symbol.toStringTag !== 'undefined';
var setEntriesExists = setExists && typeof Set.prototype.entries === 'function';
var mapEntriesExists = mapExists && typeof Map.prototype.entries === 'function';
var setIteratorPrototype = setEntriesExists && Object.getPrototypeOf(new Set().entries());
var mapIteratorPrototype = mapEntriesExists && Object.getPrototypeOf(new Map().entries());
var arrayIteratorExists = symbolIteratorExists && typeof Array.prototype[Symbol.iterator] === 'function';
var arrayIteratorPrototype = arrayIteratorExists && Object.getPrototypeOf([][Symbol.iterator]());
var stringIteratorExists = symbolIteratorExists && typeof String.prototype[Symbol.iterator] === 'function';
var stringIteratorPrototype = stringIteratorExists && Object.getPrototypeOf(''[Symbol.iterator]());
var toStringLeftSliceLength = 8;
var toStringRightSliceLength = -1;
/**
 * ### typeOf (obj)
 *
 * Uses `Object.prototype.toString` to determine the type of an object,
 * normalising behaviour across engine versions & well optimised.
 *
 * @param {Mixed} object
 * @return {String} object type
 * @api public
 */
function typeDetect(obj) {
  /* ! Speed optimisation
   * Pre:
   *   string literal     x 3,039,035 ops/sec ±1.62% (78 runs sampled)
   *   boolean literal    x 1,424,138 ops/sec ±4.54% (75 runs sampled)
   *   number literal     x 1,653,153 ops/sec ±1.91% (82 runs sampled)
   *   undefined          x 9,978,660 ops/sec ±1.92% (75 runs sampled)
   *   function           x 2,556,769 ops/sec ±1.73% (77 runs sampled)
   * Post:
   *   string literal     x 38,564,796 ops/sec ±1.15% (79 runs sampled)
   *   boolean literal    x 31,148,940 ops/sec ±1.10% (79 runs sampled)
   *   number literal     x 32,679,330 ops/sec ±1.90% (78 runs sampled)
   *   undefined          x 32,363,368 ops/sec ±1.07% (82 runs sampled)
   *   function           x 31,296,870 ops/sec ±0.96% (83 runs sampled)
   */
  var typeofObj = typeof obj;
  if (typeofObj !== 'object') {
    return typeofObj;
  }

  /* ! Speed optimisation
   * Pre:
   *   null               x 28,645,765 ops/sec ±1.17% (82 runs sampled)
   * Post:
   *   null               x 36,428,962 ops/sec ±1.37% (84 runs sampled)
   */
  if (obj === null) {
    return 'null';
  }

  /* ! Spec Conformance
   * Test: `Object.prototype.toString.call(window)``
   *  - Node === "[object global]"
   *  - Chrome === "[object global]"
   *  - Firefox === "[object Window]"
   *  - PhantomJS === "[object Window]"
   *  - Safari === "[object Window]"
   *  - IE 11 === "[object Window]"
   *  - IE Edge === "[object Window]"
   * Test: `Object.prototype.toString.call(this)``
   *  - Chrome Worker === "[object global]"
   *  - Firefox Worker === "[object DedicatedWorkerGlobalScope]"
   *  - Safari Worker === "[object DedicatedWorkerGlobalScope]"
   *  - IE 11 Worker === "[object WorkerGlobalScope]"
   *  - IE Edge Worker === "[object WorkerGlobalScope]"
   */
  if (obj === globalObject) {
    return 'global';
  }

  /* ! Speed optimisation
   * Pre:
   *   array literal      x 2,888,352 ops/sec ±0.67% (82 runs sampled)
   * Post:
   *   array literal      x 22,479,650 ops/sec ±0.96% (81 runs sampled)
   */
  if (
    Array.isArray(obj) &&
    (symbolToStringTagExists === false || !(Symbol.toStringTag in obj))
  ) {
    return 'Array';
  }

  // Not caching existence of `window` and related properties due to potential
  // for `window` to be unset before tests in quasi-browser environments.
  if (typeof window === 'object' && window !== null) {
    /* ! Spec Conformance
     * (https://html.spec.whatwg.org/multipage/browsers.html#location)
     * WhatWG HTML$7.7.3 - The `Location` interface
     * Test: `Object.prototype.toString.call(window.location)``
     *  - IE <=11 === "[object Object]"
     *  - IE Edge <=13 === "[object Object]"
     */
    if (typeof window.location === 'object' && obj === window.location) {
      return 'Location';
    }

    /* ! Spec Conformance
     * (https://html.spec.whatwg.org/#document)
     * WhatWG HTML$3.1.1 - The `Document` object
     * Note: Most browsers currently adher to the W3C DOM Level 2 spec
     *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-26809268)
     *       which suggests that browsers should use HTMLTableCellElement for
     *       both TD and TH elements. WhatWG separates these.
     *       WhatWG HTML states:
     *         > For historical reasons, Window objects must also have a
     *         > writable, configurable, non-enumerable property named
     *         > HTMLDocument whose value is the Document interface object.
     * Test: `Object.prototype.toString.call(document)``
     *  - Chrome === "[object HTMLDocument]"
     *  - Firefox === "[object HTMLDocument]"
     *  - Safari === "[object HTMLDocument]"
     *  - IE <=10 === "[object Document]"
     *  - IE 11 === "[object HTMLDocument]"
     *  - IE Edge <=13 === "[object HTMLDocument]"
     */
    if (typeof window.document === 'object' && obj === window.document) {
      return 'Document';
    }

    if (typeof window.navigator === 'object') {
      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/multipage/webappapis.html#mimetypearray)
       * WhatWG HTML$8.6.1.5 - Plugins - Interface MimeTypeArray
       * Test: `Object.prototype.toString.call(navigator.mimeTypes)``
       *  - IE <=10 === "[object MSMimeTypesCollection]"
       */
      if (typeof window.navigator.mimeTypes === 'object' &&
          obj === window.navigator.mimeTypes) {
        return 'MimeTypeArray';
      }

      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/multipage/webappapis.html#pluginarray)
       * WhatWG HTML$8.6.1.5 - Plugins - Interface PluginArray
       * Test: `Object.prototype.toString.call(navigator.plugins)``
       *  - IE <=10 === "[object MSPluginsCollection]"
       */
      if (typeof window.navigator.plugins === 'object' &&
          obj === window.navigator.plugins) {
        return 'PluginArray';
      }
    }

    if ((typeof window.HTMLElement === 'function' ||
        typeof window.HTMLElement === 'object') &&
        obj instanceof window.HTMLElement) {
      /* ! Spec Conformance
      * (https://html.spec.whatwg.org/multipage/webappapis.html#pluginarray)
      * WhatWG HTML$4.4.4 - The `blockquote` element - Interface `HTMLQuoteElement`
      * Test: `Object.prototype.toString.call(document.createElement('blockquote'))``
      *  - IE <=10 === "[object HTMLBlockElement]"
      */
      if (obj.tagName === 'BLOCKQUOTE') {
        return 'HTMLQuoteElement';
      }

      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/#htmltabledatacellelement)
       * WhatWG HTML$4.9.9 - The `td` element - Interface `HTMLTableDataCellElement`
       * Note: Most browsers currently adher to the W3C DOM Level 2 spec
       *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-82915075)
       *       which suggests that browsers should use HTMLTableCellElement for
       *       both TD and TH elements. WhatWG separates these.
       * Test: Object.prototype.toString.call(document.createElement('td'))
       *  - Chrome === "[object HTMLTableCellElement]"
       *  - Firefox === "[object HTMLTableCellElement]"
       *  - Safari === "[object HTMLTableCellElement]"
       */
      if (obj.tagName === 'TD') {
        return 'HTMLTableDataCellElement';
      }

      /* ! Spec Conformance
       * (https://html.spec.whatwg.org/#htmltableheadercellelement)
       * WhatWG HTML$4.9.9 - The `td` element - Interface `HTMLTableHeaderCellElement`
       * Note: Most browsers currently adher to the W3C DOM Level 2 spec
       *       (https://www.w3.org/TR/DOM-Level-2-HTML/html.html#ID-82915075)
       *       which suggests that browsers should use HTMLTableCellElement for
       *       both TD and TH elements. WhatWG separates these.
       * Test: Object.prototype.toString.call(document.createElement('th'))
       *  - Chrome === "[object HTMLTableCellElement]"
       *  - Firefox === "[object HTMLTableCellElement]"
       *  - Safari === "[object HTMLTableCellElement]"
       */
      if (obj.tagName === 'TH') {
        return 'HTMLTableHeaderCellElement';
      }
    }
  }

  /* ! Speed optimisation
  * Pre:
  *   Float64Array       x 625,644 ops/sec ±1.58% (80 runs sampled)
  *   Float32Array       x 1,279,852 ops/sec ±2.91% (77 runs sampled)
  *   Uint32Array        x 1,178,185 ops/sec ±1.95% (83 runs sampled)
  *   Uint16Array        x 1,008,380 ops/sec ±2.25% (80 runs sampled)
  *   Uint8Array         x 1,128,040 ops/sec ±2.11% (81 runs sampled)
  *   Int32Array         x 1,170,119 ops/sec ±2.88% (80 runs sampled)
  *   Int16Array         x 1,176,348 ops/sec ±5.79% (86 runs sampled)
  *   Int8Array          x 1,058,707 ops/sec ±4.94% (77 runs sampled)
  *   Uint8ClampedArray  x 1,110,633 ops/sec ±4.20% (80 runs sampled)
  * Post:
  *   Float64Array       x 7,105,671 ops/sec ±13.47% (64 runs sampled)
  *   Float32Array       x 5,887,912 ops/sec ±1.46% (82 runs sampled)
  *   Uint32Array        x 6,491,661 ops/sec ±1.76% (79 runs sampled)
  *   Uint16Array        x 6,559,795 ops/sec ±1.67% (82 runs sampled)
  *   Uint8Array         x 6,463,966 ops/sec ±1.43% (85 runs sampled)
  *   Int32Array         x 5,641,841 ops/sec ±3.49% (81 runs sampled)
  *   Int16Array         x 6,583,511 ops/sec ±1.98% (80 runs sampled)
  *   Int8Array          x 6,606,078 ops/sec ±1.74% (81 runs sampled)
  *   Uint8ClampedArray  x 6,602,224 ops/sec ±1.77% (83 runs sampled)
  */
  var stringTag = (symbolToStringTagExists && obj[Symbol.toStringTag]);
  if (typeof stringTag === 'string') {
    return stringTag;
  }

  var objPrototype = Object.getPrototypeOf(obj);
  /* ! Speed optimisation
  * Pre:
  *   regex literal      x 1,772,385 ops/sec ±1.85% (77 runs sampled)
  *   regex constructor  x 2,143,634 ops/sec ±2.46% (78 runs sampled)
  * Post:
  *   regex literal      x 3,928,009 ops/sec ±0.65% (78 runs sampled)
  *   regex constructor  x 3,931,108 ops/sec ±0.58% (84 runs sampled)
  */
  if (objPrototype === RegExp.prototype) {
    return 'RegExp';
  }

  /* ! Speed optimisation
  * Pre:
  *   date               x 2,130,074 ops/sec ±4.42% (68 runs sampled)
  * Post:
  *   date               x 3,953,779 ops/sec ±1.35% (77 runs sampled)
  */
  if (objPrototype === Date.prototype) {
    return 'Date';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-promise.prototype-@@tostringtag)
   * ES6$25.4.5.4 - Promise.prototype[@@toStringTag] should be "Promise":
   * Test: `Object.prototype.toString.call(Promise.resolve())``
   *  - Chrome <=47 === "[object Object]"
   *  - Edge <=20 === "[object Object]"
   *  - Firefox 29-Latest === "[object Promise]"
   *  - Safari 7.1-Latest === "[object Promise]"
   */
  if (promiseExists && objPrototype === Promise.prototype) {
    return 'Promise';
  }

  /* ! Speed optimisation
  * Pre:
  *   set                x 2,222,186 ops/sec ±1.31% (82 runs sampled)
  * Post:
  *   set                x 4,545,879 ops/sec ±1.13% (83 runs sampled)
  */
  if (setExists && objPrototype === Set.prototype) {
    return 'Set';
  }

  /* ! Speed optimisation
  * Pre:
  *   map                x 2,396,842 ops/sec ±1.59% (81 runs sampled)
  * Post:
  *   map                x 4,183,945 ops/sec ±6.59% (82 runs sampled)
  */
  if (mapExists && objPrototype === Map.prototype) {
    return 'Map';
  }

  /* ! Speed optimisation
  * Pre:
  *   weakset            x 1,323,220 ops/sec ±2.17% (76 runs sampled)
  * Post:
  *   weakset            x 4,237,510 ops/sec ±2.01% (77 runs sampled)
  */
  if (weakSetExists && objPrototype === WeakSet.prototype) {
    return 'WeakSet';
  }

  /* ! Speed optimisation
  * Pre:
  *   weakmap            x 1,500,260 ops/sec ±2.02% (78 runs sampled)
  * Post:
  *   weakmap            x 3,881,384 ops/sec ±1.45% (82 runs sampled)
  */
  if (weakMapExists && objPrototype === WeakMap.prototype) {
    return 'WeakMap';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-dataview.prototype-@@tostringtag)
   * ES6$24.2.4.21 - DataView.prototype[@@toStringTag] should be "DataView":
   * Test: `Object.prototype.toString.call(new DataView(new ArrayBuffer(1)))``
   *  - Edge <=13 === "[object Object]"
   */
  if (dataViewExists && objPrototype === DataView.prototype) {
    return 'DataView';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%mapiteratorprototype%-@@tostringtag)
   * ES6$23.1.5.2.2 - %MapIteratorPrototype%[@@toStringTag] should be "Map Iterator":
   * Test: `Object.prototype.toString.call(new Map().entries())``
   *  - Edge <=13 === "[object Object]"
   */
  if (mapExists && objPrototype === mapIteratorPrototype) {
    return 'Map Iterator';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%setiteratorprototype%-@@tostringtag)
   * ES6$23.2.5.2.2 - %SetIteratorPrototype%[@@toStringTag] should be "Set Iterator":
   * Test: `Object.prototype.toString.call(new Set().entries())``
   *  - Edge <=13 === "[object Object]"
   */
  if (setExists && objPrototype === setIteratorPrototype) {
    return 'Set Iterator';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%arrayiteratorprototype%-@@tostringtag)
   * ES6$22.1.5.2.2 - %ArrayIteratorPrototype%[@@toStringTag] should be "Array Iterator":
   * Test: `Object.prototype.toString.call([][Symbol.iterator]())``
   *  - Edge <=13 === "[object Object]"
   */
  if (arrayIteratorExists && objPrototype === arrayIteratorPrototype) {
    return 'Array Iterator';
  }

  /* ! Spec Conformance
   * (http://www.ecma-international.org/ecma-262/6.0/index.html#sec-%stringiteratorprototype%-@@tostringtag)
   * ES6$21.1.5.2.2 - %StringIteratorPrototype%[@@toStringTag] should be "String Iterator":
   * Test: `Object.prototype.toString.call(''[Symbol.iterator]())``
   *  - Edge <=13 === "[object Object]"
   */
  if (stringIteratorExists && objPrototype === stringIteratorPrototype) {
    return 'String Iterator';
  }

  /* ! Speed optimisation
  * Pre:
  *   object from null   x 2,424,320 ops/sec ±1.67% (76 runs sampled)
  * Post:
  *   object from null   x 5,838,000 ops/sec ±0.99% (84 runs sampled)
  */
  if (objPrototype === null) {
    return 'Object';
  }

  return Object
    .prototype
    .toString
    .call(obj)
    .slice(toStringLeftSliceLength, toStringRightSliceLength);
}

return typeDetect;

})));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],41:[function(require,module,exports){
/**
 * @namespace pgp
 * @memberOf sesamed
 */
"use strict";
// global npm packages
const openpgp = require("openpgp");

/**
 * Creates a new pgp key pair
 * @alias module:sesamed.pgp.generateKeys
 * @param {String} name - the name associated with the pgp keys
 * @param {String} passphrase - the passphrase protecting the private key
 * @returns {Promise}
 * @resolve {PgpKeys} pgpKeys
 * @reject {Error}
 */
function generateKeys(name, passphrase) {
    if (!name || !passphrase || typeof name !== "string" || typeof passphrase !== "string") {
        throw(new Error("pgp.generateKeys: missing name or passphrase"));
    }

    return openpgp.generateKey({
        userIds: {name: name},
        curve: "ed25519",
        passphrase: passphrase
    }).then(key => {
        let privateKey = key.privateKeyArmored,
            publicKey = key.publicKeyArmored;

        return {
            privateKey: privateKey,
            publicKey: publicKey,
        };
    });
}

/**
 * returns a the publicKey from a privateKey and a passphrase
 * @alias module:"sesamed.pgp".getPublicKeyFromPrivateKey
 * @param {String} privateKey
 * @param {String} passphrase
 * @returns {Promise}
 * @resolve {String} publicKey
 * @reject {Error}
 */
async function getPublicKeyFromPrivateKey(privateKey, passphrase) {
    let privateKeyObj = (await openpgp.key.readArmored(privateKey)).keys[0];
    privateKeyObj.decrypt(passphrase);
    let publicKey = privateKeyObj.toPublic().armor();
    return publicKey;
}

/**
 * Encrypts data with public key and signs if private key is provided
 * @alias module:"sesamed.pgp".encrypt
 * @memberof module:"sesamed.pgp"
 * @param {Object} options
 * @param {String} options.publicKey
 * @param {String} options.privateKey
 * @param {String} options.passphrase
 * @param {String} options.cleartext
 * @returns {Promise}
 * @resolve {string} ciphertext
 * @reject {Error}
 */
async function encrypt(options) {
    let privateKey,
        privateKeys,
        publicKeys = [];

    if (options.privateKey) {
        privateKey = (await openpgp.key.readArmored(options.privateKey)).keys[0];
        await privateKey.decrypt(options.passphrase);
        privateKeys = [privateKey];
    }

    if (Array.isArray(options.publicKey)) {
        publicKeys = await Promise.all(options.publicKey.map(async (key) => {
            return (await openpgp.key.readArmored(key)).keys[0];
        }));
    } else {
        publicKeys = (await openpgp.key.readArmored(options.publicKey)).keys[0];
    }

    return openpgp.encrypt({
        message: openpgp.message.fromText(options.cleartext),
        publicKeys: publicKeys,
        privateKeys: privateKeys,
        compression: openpgp.enums.compression.zip
    }).then(ciphertext => ciphertext.data);
}

/**
 * Decrypts data with private key and checks signature if public key is provided
 * @alias module:"sesamed.pgp".decrypt
 * @memberof module:"sesamed.pgp"
 * @param {Object} options
 * @param {String} options.privateKey
 * @param {String} options.passphrase
 * @param {String} [options.publicKey]
 * @param {String} options.ciphertext
 * @returns {Promise}
 * @resolve {string} cleartext
 * @reject {Error}
 */
async function decrypt(options) {
    let privateKey = (await openpgp.key.readArmored(options.privateKey)).keys[0],
        publicKeys;

    await privateKey.decrypt(options.passphrase);

    if (options.publicKey) {
        publicKeys = (await openpgp.key.readArmored(options.publicKey)).keys;
    }

    return openpgp.decrypt({
        message: await openpgp.message.readArmored(options.ciphertext),
        publicKeys: publicKeys,
        privateKeys: privateKey
    }).then(async plaintext => {
        let signature = plaintext.signatures[0];

        if (publicKeys) {
            if (!(await signature.verified)) {
                throw new Error("Signature not verified");
            }
        }
        return plaintext.data;
    });
}

/**
 * @module "sesamed.pgp"
 */

let pgp = {
    generateKeys: generateKeys,
    getPublicKeyFromPrivateKey: getPublicKeyFromPrivateKey,
    encrypt: encrypt,
    decrypt: decrypt
};

module.exports = pgp;

},{"openpgp":38}],42:[function(require,module,exports){
// test framework
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;

// local modules
var pgp = require("../src/pgp");

// test data
var testData = require("./testdata.js").testData;


describe("pgp", function () {

    describe("generateKeys", function () {

        let err = "pgp.generateKeys: missing name or passphrase";

        it("should throw error if name is missing", async function () {
            return expect(() => pgp.generateKeys()).to.throw(err);
        });

        it("should throw error if passphrase is missing", async function () {
            return expect(() => pgp.generateKeys("alice")).to.throw(err);
        });

        it("should throw error if name is no string", async function () {
            return expect(() => pgp.generateKeys(1, "passphrase")).to.throw(err);
        });

        it("should throw error if passphrase is no string", async function () {
            return expect(() => pgp.generateKeys("alice", {})).to.throw(err);
        });

        it("should call openpgp.generateKeys with correct params", async function () {
            let keys = await pgp.generateKeys("alice", "passphrase");

            expect(keys.publicKey.substr(0,36)).to.equal("-----BEGIN PGP PUBLIC KEY BLOCK-----");
            expect(keys.privateKey.substr(0,37)).to.equal("-----BEGIN PGP PRIVATE KEY BLOCK-----");
        });

    });

    describe("getPublicKeyFromPrivateKey", function () {

        it("should get public key from private key", async function() {
            let publicKey = await pgp.getPublicKeyFromPrivateKey(testData[0].privateKey, testData[0].passphrase);

            expect(publicKey).to.equal(testData[0].publicKey);
        });

    });

    describe("encrypt", function () {

        it("should return an encrypted string if clearttext and publicKey are provided", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[1].cleartext,
                publicKey: testData[0].publicKey
            });
            expect(ciphertext.substr(0,27)).to.equal("-----BEGIN PGP MESSAGE-----");
        });

        it("should return an signed and encrypted string if privateKey is provided", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[1].cleartext,
                publicKey: testData[0].publicKey,
                privateKey: testData[1].privateKey,
                passphrase: testData[1].passphrase
            });
            expect(ciphertext.substr(0,27)).to.equal("-----BEGIN PGP MESSAGE-----");
        });

        it("should work with multiple publicKeys", async function () {
            let ciphertext = await pgp.encrypt({
                cleartext: testData[2].cleartext,
                publicKey: [testData[0].publicKey, testData[1].publicKey],
                privateKey: testData[2].privateKey,
                passphrase: testData[2].passphrase
            });
            expect(ciphertext.substr(0,27)).to.equal("-----BEGIN PGP MESSAGE-----");
        });

    });

    describe("decrypt", function () {

        it("should return cleartext if privateKey, passphrase and ciphertext are provided", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey
            });
            expect(cleartext).to.equal(testData[0].cleartext);
        });

        it("should get rejected if wrong privateKey is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: testData[1].passphrase,
                privateKey: testData[1].privateKey
            });
            return expect(promise).to.be.rejectedWith("Error decrypting message: Session key decryption failed.");
        });

        it("should get rejected if wrong passphrase is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                passphrase: "wrong passphrase",
                privateKey: testData[0].privateKey
            });
            return expect(promise).to.be.rejectedWith("Incorrect key passphrase");

        });

        it("should get rejected if no passphrase is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertext,
                privateKey: testData[0].privateKey
            });
            return expect(promise).to.be.rejectedWith("Incorrect key passphrase");
        });

        it("should return cleartext and check signature if correct publicKey is provided", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextSignedWith1,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[1].privateKey
            });
            expect(cleartext).to.equal(testData[0].cleartext);
        });

        it("should check signature and throw Error if wrong publicKey is provided", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertextSignedWith1,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[0].privateKey
            });
            return expect(promise).to.be.rejectedWith("Signature not verified");
        });

        it("should work with first of multiple receiver", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[0].passphrase,
                privateKey: testData[0].privateKey,
                publicKey: testData[2].privateKey
            });
            expect(cleartext).to.equal(testData[2].cleartext);
        });

        it("should work with second of multiple receiver", async function () {
            let cleartext = await pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[1].passphrase,
                privateKey: testData[1].privateKey,
                publicKey: testData[2].privateKey
            });
            expect(cleartext).to.equal(testData[2].cleartext);
        });

        it("should not work with third of multiple receiver", async function () {
            let promise = pgp.decrypt({
                ciphertext: testData[0].ciphertextFor0and1signedWith2,
                passphrase: testData[2].passphrase,
                privateKey: testData[2].privateKey,
                publicKey: testData[2].privateKey
            });
            return expect(promise).to.be.rejectedWith("Error decrypting message: Session key decryption failed.");
        });

    });
});


},{"../src/pgp":41,"./testdata.js":43,"chai":3,"chai-as-promised":2}],43:[function(require,module,exports){
var testData = [
    {
        "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: OpenPGP.js v4.4.7\r\nComment: https://openpgpjs.org\r\n\r\nxjMEXGBIdBYJKwYBBAHaRw8BAQdABfpiXQt0uWYYSFS4HccwzzIWfjargdIb\r\n6aS6vaHmXxnNBkpvY2hlbsJ3BBAWCgAfBQJcYEh0BgsJBwgDAgQVCAoCAxYC\r\nAQIZAQIbAwIeAQAKCRC8ZVPUbhk7PjjQAP9CUrPtEWrXifJDWpLolbtbLewL\r\n5zGxewsgFhHCD69DlAEAxehFIxKri0Hltb8K+lxzAdSB321e1HXILpc78cUN\r\nDgbOOARcYEh0EgorBgEEAZdVAQUBAQdAdeaZ9u7+eejmCW1Skp8q9nrI/PY/\r\n8jLDmy+hEy6LI0EDAQgHwmEEGBYIAAkFAlxgSHQCGwwACgkQvGVT1G4ZOz7q\r\nLAEA+hSJFUYQ86jSrcRSqQYFvYRi6O4r9NR71LgTjpmdHf4BAMFnxdcGGv85\r\nYrx4CBX+YKziHLZOHHFP0ELkc90fjL8L\r\n=ur/5\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n",
        "privateKey": "-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: OpenPGP.js v4.4.7\r\nComment: https://openpgpjs.org\r\n\r\nxYYEXGBIdBYJKwYBBAHaRw8BAQdABfpiXQt0uWYYSFS4HccwzzIWfjargdIb\r\n6aS6vaHmXxn+CQMIFed1vnOv+E3geqU2WniQ5S0Kq05/AClho2rzFaPNRlox\r\nnwyRW59FSWfehAvAN9Q17AzTJYhyeOFJvrdqrRc7OirTXnJU5Jw77OtBdBFk\r\nIc0GSm9jaGVuwncEEBYKAB8FAlxgSHQGCwkHCAMCBBUICgIDFgIBAhkBAhsD\r\nAh4BAAoJELxlU9RuGTs+ONAA/0JSs+0RateJ8kNakuiVu1st7AvnMbF7CyAW\r\nEcIPr0OUAQDF6EUjEquLQeW1vwr6XHMB1IHfbV7UdcgulzvxxQ0OBseLBFxg\r\nSHQSCisGAQQBl1UBBQEBB0B15pn27v556OYJbVKSnyr2esj89j/yMsObL6ET\r\nLosjQQMBCAf+CQMIgajb6oIywlrgzMDQyehIikmRB9ta8x4Ut8s0KW1uhyJA\r\nCO4lqtj4Q+TPmhR+RPiJKzU69hwO74LkJQtbEqLefXDiswl0YjeXhD45kmpH\r\n9MJhBBgWCAAJBQJcYEh0AhsMAAoJELxlU9RuGTs+6iwBAPoUiRVGEPOo0q3E\r\nUqkGBb2EYujuK/TUe9S4E46ZnR3+AQDBZ8XXBhr/OWK8eAgV/mCs4hy2Thxx\r\nT9BC5HPdH4y/Cw==\r\n=r+Fq\r\n-----END PGP PRIVATE KEY BLOCK-----\r\n",
        "passphrase": "passphrase",
        "cleartext": "I am a cleartext.",
        "ciphertext": "-----BEGIN PGP MESSAGE-----\nVersion: OpenPGP.js v4.4.7\nComment: https://openpgpjs.org\n\nwV4Dbnp83JALN2ASAQdAmUUsEh/d0W4l7VkhBk+l9GMshR8LjYsIw9oaEmz0\nxTMwNQp13LAKhm9B/W4Oe/byo5WC+EnG8pG7GQdnm4cYwO78KrDHQGUUIPqz\nc4bssQMT0kkB9ZDoZpqgauGlKObT6oMmOQSHceClCJqru4TpdnFr4kYbHz+9\nHc/cCCcNx6tI9bbOh/lerQeTaCeAW11hJ0b72XSZeqMfhoUw\n=0RTw\n-----END PGP MESSAGE-----\r\n",
        "ciphertextSignedWith1": "-----BEGIN PGP MESSAGE-----\nVersion: OpenPGP.js v4.4.7\nComment: https://openpgpjs.org\n\nwV4Dbnp83JALN2ASAQdAz/2vCQcgHPe9q9xT9O8p+zqjkoWvgyW19nmShVYB\nR1IwE+szsuB52T1g7E/OkekkkpddDqvWoYflxNfwla0eliVakMy9U8Zo/gle\nlr+a+Vmk0rgBW+2UbYhfEghIuN9VYSzzlxD8VnkrJic7K5b5d58edV0Jpw29\nJhpzui8DeNGH/x9h5NZwVpPShjsAa0+tkJY+rv9u0J5O/71SHTj7+5f00qZR\nxW0lShyEmQG0He+KD2KML3tC56uQ13wTORuHyk+fixbBwrehZfZOFQxhlAdz\nzl4OZl/1oWCusuVmeGrsK3xyaSmPU3GhoONS0GolMxVlvgx1uTviNKrBtag3\nYWHnbAHNFrBGgSaa\n=1r8P\n-----END PGP MESSAGE-----\n\n",
        "ciphertextFor0and1signedWith2": "-----BEGIN PGP MESSAGE-----\nVersion: OpenPGP.js v4.4.7\nComment: https://openpgpjs.org\n\nwV4Dbnp83JALN2ASAQdAYOc/8aeMg2O9N+HjQ7pVCWeBvcaoX2AWHbY2usF0\naEYw2WxhrrmRCBZWzIY/g8mQgo77/R+uPeyX5LBOtOnnM5bWICg0dfFBW1ju\nsvNzCOXKwV4DSMbn20iCppMSAQdAFbYe+IPVUEDViP+oQumpU8xC9kOF46/L\nlDRMlNLACGQw6xkP0yaT36rYNgm0UwTxyvaVUm3oOkeDiyqQN/FGxLXZAAvv\ngIGGbyjmToWuF0xH0rwBJ2FArVTb4jYw5tp2bBxRhHu7E5+A/KQUUrJPxFYA\ntI9RpDbCZuuMuUCbz7VG3NQQDUKgT9y1XYTIqadgD9aT/FwV5MSW4wRrU/hz\nqOKkVpAFT7XjBh4KLY3aTlG+vmegbHLNYyC93H/BHuu2vidg0DR6lSOPaEly\nXQOlNIVBUdhU0qLF2aB1Fqq7oFyBPimKyH0+tSn7zTtKCHbQByVlK3kVSYx5\nxeoNTpS8iEomFMUPnvX+46akOvRfGw==\n=qDtk\n-----END PGP MESSAGE-----\n\n",
        "aesKey": "t7oE4TUt7UOvjvzH-vJ4aPDP-BCrGM548pD9gPeLCBE",
        "aesCiphertext": "AAAGAmPiHCyiW1GExt+JCJ5ktPgesPbw6VD/zTt3eFgOpJEgtagNTm+KOeGqo3c4A4F+",
        "ipfsHash": "QmS54VVbSuvBnCPaZLXrfTRLtF8KHhWsBSpTCS2J4BaCW9",
        "multihash": {
            "digest": "0x37705883cc57601fa74fd8f67886ec3a224a6c0d7e48a145df8433d258d8358e",
            "hashFunction": 18,
            "size": 32
        }
    },
    {
        "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: OpenPGP.js v4.4.7\r\nComment: https://openpgpjs.org\r\n\r\nxjMEXGBIdRYJKwYBBAHaRw8BAQdAcH1pANmvdlnss3RY1pS80l+LOUZAn08n\r\njdarE0VK3vvNA0phbsJ3BBAWCgAfBQJcYEh1BgsJBwgDAgQVCAoCAxYCAQIZ\r\nAQIbAwIeAQAKCRCr9BJDpozWW9VsAQC5renxI1R/kuI44t2t/j8mXMDh+uGd\r\nQrV9DLChFnT0FwD9HvVZ3zyJje+3PHPuQSvnP3Lkl0/V1qtkz/Mqk55DpAzO\r\nOARcYEh1EgorBgEEAZdVAQUBAQdAS1/AuncdGiZNUtU1Kz2cf2WrJqdkyKlr\r\nkur2HoLubQ0DAQgHwmEEGBYIAAkFAlxgSHUCGwwACgkQq/QSQ6aM1lvocgD5\r\nAAUZ1CPCZkglhT8bZrpqEZBHgKsc0bAx88hcd8TlOIoA/1c4SglyW0hlxuYx\r\n2Iy+cFlusKPqC3fUzctrTHki7eYM\r\n=P1ae\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n",
        "privateKey": "-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: OpenPGP.js v4.4.7\r\nComment: https://openpgpjs.org\r\n\r\nxYYEXGBIdRYJKwYBBAHaRw8BAQdAcH1pANmvdlnss3RY1pS80l+LOUZAn08n\r\njdarE0VK3vv+CQMIpSnBX2Zsk0TgzRjUoQkij3Yy43tu1vZbs3OzBhmv0ilZ\r\nfG/OMUqyo8khfPpbIUpyPfvdnvMcD2jCg5Ak/SkgjqmdAM87Sa36uMIt7CWT\r\nKs0DSmFuwncEEBYKAB8FAlxgSHUGCwkHCAMCBBUICgIDFgIBAhkBAhsDAh4B\r\nAAoJEKv0EkOmjNZb1WwBALmt6fEjVH+S4jji3a3+PyZcwOH64Z1CtX0MsKEW\r\ndPQXAP0e9VnfPImN77c8c+5BK+c/cuSXT9XWq2TP8yqTnkOkDMeLBFxgSHUS\r\nCisGAQQBl1UBBQEBB0BLX8C6dx0aJk1S1TUrPZx/Zasmp2TIqWuS6vYegu5t\r\nDQMBCAf+CQMIUpD1Oqu3eHngfJLapNzqBtGvKBqAJSuhKfgp4E9vp/3YVxmO\r\nxPUeFjZki0OJWeVLXVsS3VxAFkbgEbyWZ5ruNdRkKoBT/ho11GakO+IeVMJh\r\nBBgWCAAJBQJcYEh1AhsMAAoJEKv0EkOmjNZb6HIA+QAFGdQjwmZIJYU/G2a6\r\nahGQR4CrHNGwMfPIXHfE5TiKAP9XOEoJcltIZcbmMdiMvnBZbrCj6gt31M3L\r\na0x5Iu3mDA==\r\n=gnDQ\r\n-----END PGP PRIVATE KEY BLOCK-----\r\n",
        "passphrase": "passphrase",
        "cleartext": "I am a cleartext of 1."
    },
    {
        "publicKey": "-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: OpenPGP.js v4.4.7\r\nComment: https://openpgpjs.org\r\n\r\nxjMEXGBIdRYJKwYBBAHaRw8BAQdAhwHILblo3Xq2zGuoZJ9UZg9SqfcbMAMb\r\n7BquK2hdrFXNBEthdHnCdwQQFgoAHwUCXGBIdQYLCQcIAwIEFQgKAgMWAgEC\r\nGQECGwMCHgEACgkQHHTQiIrT+MDQdAEA57m9EnzPstLhltriDA7h2VDr476B\r\nfZkezvMhW6WMBjUA/2mF+cU9w8shlrWMyJWVMYFbUwIlQv0FLKeBo4IV/58B\r\nzjgEXGBIdRIKKwYBBAGXVQEFAQEHQPz3mJSXscEXaUWNYD2QypTqA/IzBvQa\r\nkt7EAYHQSsIOAwEIB8JhBBgWCAAJBQJcYEh1AhsMAAoJEBx00IiK0/jAnHYA\r\n/0Dl/kJA4tLWVjlX2JdXCVHeYKgyF3sMvO/W/iW9aseFAQDaq4XJi7WT7OVs\r\ns9gRNXvbaPKqbeEUIpzJZOnQwTRMBg==\r\n=l2ZW\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n",
        "privateKey": "-----BEGIN PGP PRIVATE KEY BLOCK-----\r\nVersion: OpenPGP.js v4.4.7\r\nComment: https://openpgpjs.org\r\n\r\nxYYEXGBIdRYJKwYBBAHaRw8BAQdAhwHILblo3Xq2zGuoZJ9UZg9SqfcbMAMb\r\n7BquK2hdrFX+CQMIQnO1upIyE5TgAy35qDyZisosPFGhPWRWSq7ldqieeVAN\r\nbSqD4hLZyOETlOZucggEq7RKh+OwZnFTe294k/4tFK9yrD4eUzkyjZhoGEdJ\r\nPM0ES2F0ecJ3BBAWCgAfBQJcYEh1BgsJBwgDAgQVCAoCAxYCAQIZAQIbAwIe\r\nAQAKCRAcdNCIitP4wNB0AQDnub0SfM+y0uGW2uIMDuHZUOvjvoF9mR7O8yFb\r\npYwGNQD/aYX5xT3DyyGWtYzIlZUxgVtTAiVC/QUsp4GjghX/nwHHiwRcYEh1\r\nEgorBgEEAZdVAQUBAQdA/PeYlJexwRdpRY1gPZDKlOoD8jMG9BqS3sQBgdBK\r\nwg4DAQgH/gkDCGUl9cfU7Pyj4BYHbomoyeY0fn0J/rNxD1HO8BLfG0Ihvajl\r\ntK2GGcwPayjIGxnsurySegPiPemgRI7npmYEu4mVRgs2rkxcreCeZB5Fw+3C\r\nYQQYFggACQUCXGBIdQIbDAAKCRAcdNCIitP4wJx2AP9A5f5CQOLS1lY5V9iX\r\nVwlR3mCoMhd7DLzv1v4lvWrHhQEA2quFyYu1k+zlbLPYETV722jyqm3hFCKc\r\nyWTp0ME0TAY=\r\n=bnA9\r\n-----END PGP PRIVATE KEY BLOCK-----\r\n",
        "passphrase": "passphrase",
        "cleartext": "I am a cleartext of 2"
    }
];

exports.testData = testData;

},{}]},{},[42]);
