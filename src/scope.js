/**
 * ch1 Scope
 * watcher销毁略过
 */
// Scope类
function Scope() {
    this.$$watchers = []; // 观察者数组 $$b表示angular中的私有属性
    this.$$lastDirtyWatch = null; // 最后一个脏值
    this.$$asyncQuene = []; // 延迟函数的队列数组
    this.$$applyAsyncQuene = []; // 延迟$apply调用的队列数组
    this.$$applyAsyncId = null; // 追踪执行$applyAsyncQuene队列的setTimeout调用是否已经在执行
    this.$$phase = null; // scope所处的阶段，$digest $apply 或者 null
    this.$$children = []; // 子作用域
    this.$root = this; // 根作用域，在new Scope的时候建立，继承的时候不会改变它
    this.$$listeners = {}; // 事件系统，储存事件对象
}
// 用函数表示初始值是独一无二的，不会与任何值相等
function initWatchVal() {}

Scope.prototype.$watch = function(watchFn, listenerFn, valueEq) {
    var watcher = {
        watchFn: watchFn, // 使用函数返回值，每次获取的都是最新的newVal
        listenerFn: listenerFn || function() {}, // 
        valueEq: !!valueEq, // object、array是引用传值，对比oldVal和newVal会一直相等，使用这个标志位来标记是否比较真实值
        last: initWatchVal // 空函数，防止undefined会和默认未定义的undefined判断相等
    };
    this.$$watchers.unshift(watcher);
    this.$root.$$lastDirtyWatch = null;
    return function() {
        var index = self.$$watchers.indexOf(watcher);
        if (index >= 0) {
            self.$$watchers.splice(index, 1);
            self.$root.$$lastDirtyWatch = null; // 每次增加watcher时，清空$$lastDirtyWatch
        }
    };
};

/** 
 * $digest()就是脏检测的过程，对比newVal和oldVal，不相等就更新数据，并执行回调
 * 问题：何时检测，检测多少次
 */
Scope.prototype.$digest = function() {
    var dirty;
    this.$root.$$lastDirtyWatch = null;
    /**
     * 至少检测一次，看起来很完美，因为如果有watcher发生改变dirty=true，必定会再有一次循环，直至无变化。
     * 但是，问题出在哪里，如果2个watcher互相改变watch数据的值，会产生无限循环。需要一个值来限制这种情况
     */
    // do {
    //   dirty = this.$$digestOnce();
    // } while(dirty);
    var ttl = 10;
    this.$beginPhase('$digest'); // $digest阶段，调用阶段开始方法，会将'$digest'赋值给$$phase

    if (this.$root.$$applyAsyncId) {
        clearTimeout(this.$root.$$applyAsyncId);
        this.$$flushApplyAsync();
    }

    do {
        while (this.$$asyncQuene.length) {
            var asyncTask = this.$$asyncQuene.shift();
            asyncTask.scope.$eval(asyncTask.expression);
        }
        dirty = this.$$digestOnce();
        if ((dirty || this.$$asyncQuene.length) && !(ttl--)) {
            this.$clearPhase(); // $digest出错，清除阶段变量
            throw "10 digest interations reached";
        }
    } while (dirty || this.$$asyncQuene.length); // 增加$$asyncQuene的长度循环条件，如果scope数据不变了，但有操作加入了一个或多个$$asyncQuene队列，会导致无法执行。

    this.$clearPhase(); // $digest结束，清除阶段变量
};

// scope执行环境
Scope.prototype.$eval = function(func, argv) {
    return func(this, argv); // func的第一个参数就是当前scope
};

// $apply方法提供一个手动执行$digest的方法
Scope.prototype.$apply = function(func) {
    try {
        this.$beginPhase('$apply'); // 增加'$apply'阶段开始标志
        this.$eval(func);
    } finally {
        this.$clearPhase(); // 在digest循环之前，清除$$phase变量
        this.$root.$digest(); // 执行$digest循环
    }
};

// $evalAsync带上执行环境（当前scope）
Scope.prototype.$evalAsync = function(expr) {
    var self = this;
    if (!self.$$phase && !self.$$asyncQuene.length) {
        setTimeout(function() {
            if (self.$$asyncQuene.length) {
                self.$root.$digest();
            }
        }, 0);
    }

    this.$$asyncQuene.push({ scope: this.scope, expression: expr });
};

Scope.prototype.$applyAsync = function(expr) {
    var self = this;
    self.$$applyAsyncQuene.push(function() {
        self.$eval(expr);
    });
    if (self.$root.$$applyAsyncId === null) {
        self.$root.$$applyAsyncId = setTimeout(function() {
            self.$apply(function() {
                // 利用$apply，将队列中的任务全部合并成一个$apply调用，这样只会引起一次$digest
                console.log(typeof(self.$$flushApplyAsync));
                self.$apply(_.bind(self.$$flushApplyAsync, self));
            });
        }, 0);
    }
};

// 判断阶段存在与否并赋值，如果$$phase不为null，抛出错误
Scope.prototype.$beginPhase = function(phase) {
    if (this.$$phase) {
        throw this.$$phase + ' already in progress.';
    }
    this.$$phase = phase;
};

// 清空$$阶段变量
Scope.prototype.$clearPhase = function() {
    this.$$phase = null;
};

// applyAsync循环调用
Scope.prototype.$$flushApplyAsync = function() {
    while (self.$$applyAsyncQuene.length) {
        self.$$applyAsyncQuene.shift()(); // 先进先出，shift()后运行
    }
    self.$root.$$applyAsyncId = null;
};

// $digest里调用的单词循环，实际中angualr将其合并在了$digest里
Scope.prototype.$$digestOnce = function() {
    var dirty;
    var continueLoop = true;
    var self = this;
    this.$$everyScope(function(scope) {
        var newValue, oldValue;
        // scope是self的子作用域包括self本身，self是当前作用域
        _.forEachRight(scope.$$watchers, function(watcher) {
            newValue = watcher.watchFn(scope); // watchFn = function (scope) { return scope.XXX}
            oldValue = watcher.last;
            if (!scope.$$areEqual(newValue, oldValue, watcher.valueEq)) {
                scope.$root.$$lastDirtyWatch = watcher; // 如果有变化，设置最后变化的值$$lastDirtyWatch
                dirty = true; // 如果有变化，dirty = true
                watcher.last = watcher.valueEq ? _.cloneDeep(newValue) : newValue; // valueEq为true时，不是简单引用，而是复制这个object或array
                // 初始值
                watcher.listenerFn(newValue,
                    (oldValue === initWatchVal ? newValue : oldValue),
                    scope);
            } else if (scope.$root.$$lastDirtyWatch === watcher) {
                continueLoop = false;
                return false;
            }
        });
        return continueLoop;
    });
    return dirty; // 返回dirty状态，供$digest判断
};

Scope.prototype.$$areEqual = function(newValue, oldValue, valueEq) {
    if (valueEq) {
        return _.isEqual(newValue, oldValue);
    } else {
        return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number' &&
            isNaN(newValue) && isNaN(oldValue)); // 加入了NaN判断相等，JS中(NaN===NaN)返回false
    }
};


/**
 * ch2  Scope的继承
 */

/**
 * $new 使用JS原型继承 返回子作用域
 * angular中scope与JS作用域原则相同，查找属性时一级一级向上查找
 * watch的数据也是一样，找到就停止，所以watch能watch父作用域中不重叠的属性
 * @param {bool}    isolated    独立作用域标识
 * @param {scope}   parent      要继承的scope(父scope，默认是当前作用域this)
 * 
 */
Scope.prototype.$new = function(isolated, parent) {
    var child;
    parent = parent || this;
    // 如果是独立作用域
    if (isolated) {
        child = new Scope();
        child.$root = parent.$root; // 新建的作用域是当前作用域的独立作用域（依然是子作用域），但是失去了$root，需要手动赋值
        child.$$asyncQueue = parent.$$asyncQueue;
        child.$$postDigestQueue = parent.$$postDigestQueue;
        child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    } else {
        var ChildScope = function() {};
        ChildScope.prototype = this; // 原型继承
        child = new ChildScope();
    }
    parent.$$children.push(child); // 在当前scope上$new的独立作用域也是子作用域，只是没有继承关系
    child.$parent = parent; // 将parent scope记录在$parent变量上
    child.$$watchers = []; // 隔离watchers
    child.$$children = [];
    child.$$listeners = {}; // 子scope初始化属性$$listeners
    return child;
};

// 递归$$children，遍历所有的child，逐个执行fn
Scope.prototype.$$everyScope = function(fn) {
    // fn(this)，遍历children执行fn，如果fn中return false就跳出循环
    if (fn(this)) {
        return this.$$children.every(function(child) {
            return child.$$everyScope(fn);
        });
    } else {
        return false;
    }
};

// 销毁scope
Scope.prototype.$destory = function() {
    this.$broadcast('$destroy'); // 传播$destory事件，内置事件，用于传播scope销毁
    var siblings = this.$parent.$$children;
    var indexOfThis = siblings.indexOf(this);
    if (indexOfThis > 0) {
        siblings.splice(indexOfThis, 1);
    }
    this.$$watcher = []; // 去除watcher脏检测
    this.$$listeners = {}; // 去除事件侦听
};

/**
 * ch3 Watching Collections
 */
Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
    var self = this;
    var newValue;
    var oldValue;
    var veryOldValue;
    var trackVeryOldValue = (listenerFn.length > 1);
    var changeCount = 0;
    var firstRun = true;

    var internalWatchFn = function(scope) {
        newValue = watchFn(scope);
        // object分支：包括object和array
        if (_.isObject(newValue)) {
            // array分支
            if (_.isArray(newValue)) {
                // oldValue不是数组，即改变了
                if (!_.isArray(oldValue)) {
                    changeCount++;
                    oldValue = [];
                }
                if (oldValue.length !== newValue.length) {
                    changeCount++;
                    oldValue.length = newValue.length;
                }
                // 对比数组每一项
                for (var i = 0; i < oldValue.length; i++) {
                    var bothNaN = _.isNaN(newValue[i]) && _.isNaN(oldValue[i]);
                    if (!bothNaN && oldValue[i] !== newValue[i]) {
                        changeCount++;
                        oldValue[i] = newValue[i];
                    }
                }
            } else { // 除array以外分支
                // 给object增加一个length，neLength和oldLength
                if (!_.isObject(oldValue) || _.isArrayLike(oldValue)) {
                    changeCount++;
                    oldValue = {};
                    oldLength = 0;
                }
                newLength = 0;
                // 对比object属性的改变
                _.forOwn(newValue, function(newVal, key) {
                    newLength++;
                    if (oldValue.hasOwnProperty(key)) {
                        var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
                        if (!bothNaN && oldValue[key] !== newVal) {
                            changeCount++;
                            oldValue[key] = newVal;
                        }
                    } else {
                        oldLength++;
                        changeCount++;
                        oldValue[key] = newVal;
                    }
                });
                // 对比object属性的增减
                if (newLength < oldLength) {
                    changeCount++;
                    _.forOwn(oldValue, function(oldVal, key) {
                        if (!newValue.hasOwnProperty(key)) {
                            oldLength--;
                            delete oldValue[key];
                        }
                    });
                }
            }
        } else { // 除去object以外分支
            if (!self.$$areEqual(newValue, oldValue, false)) {
                changeCount++;
                oldValue = newValue;
            }
        }

        return changeCount;
    };
    var internalListenerFn = function() {
        if (firstRun) {
            listenerFn(newValue, newValue, self);
            firstRun = false;
        } else {
            listenerFn(newValue, veryOldValue, self);
        }
        if (trackVeryOldValue) {
            veryOldValue = _.clone(newValue);
        }
    };
    return this.$watch(internalWatchFn, internalListenerFn);
};


/**
 * ch4 Scope Events
 * 
 */
/**
 * @param {eventName}       string          事件名
 * @param {listener}        func            监听事件的回调函数
 */
Scope.prototype.$on = function(eventName, listener) {
    var listeners = this.$$listeners[eventName];
    if (!listeners) {
        // 事件类型作为$$listeners的属性，没有的话，将值初始化为数组
        this.$$listeners[eventName] = listeners = [];
    }
    listeners.push(listener);
    return function() {
        var index = listeners.indexOf(listener);
        if (index >= 0) {
            listeners[index] = null;
        }
    };
};

// 从此scope到以上都会触发事件
Scope.prototype.$emit = function(eventName) {
    var propagationStopped = false;
    var event = {
        name: eventName,
        targetScope: this,
        stopPropagation: function() {
            propagationStopped = true;
        },
        preventDefault: function() {
            event.defaultPrevented = true;
        }
    };
    var scope = this;
    do {
        event.currentScope = scope;
        scope.$$fireEventOnScope(eventName, event);
        scope = scope.$parent;
    } while (scope && !propagationStopped);
    return event;
};

Scope.prototype.$broadcast = function(eventName) {
    var event = {
        name: eventName,
        targetScope: this,
        preventDefault: function() {
            event.defaultPrevented = true;
        }
    };
    this.$$everyScope(function(scope) {
        event.currentScope = scope;
        scope.$$fireEventOnScope(eventName, event);
        return true;
    });
    return event;
};

Scope.prototype.$$fireEventOnScope = function(eventName, listenerArgs) {
    // 事件对象，会传入回调函数listener
    var listeners = this.$$listeners[eventName] || [];
    var i = 0;
    while (i < listeners.length) {
        if (listeners[i] === null) {
            listeners.splice(i, 1);
        } else {
            try {
                listeners[i].apply(null, listenerArgs);
            } catch (e) {
                console.error(e);
            }
        }
    }
};