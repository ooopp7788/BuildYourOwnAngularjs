function createInjector(modulesToLoad) {
    // provderCache是provider的缓存，并没有实例化，只是储存这些provider（function）
    // 1、provider仅仅是把所有module.provider('xxx',{$get:function(){...}})给储存起来
    // 2、在loader中push到invokeQueue中
    // 3、在injector中遍历invokeQueue，将provider储存到providerCache中，并没有实际将依赖注入
    
    // instanceCache是实例缓存，依赖的实例
    // 1、injector.get('xxx')，使用暴露出来的getService方法
    // 2、先会从instanceCache中查找xxx实例，再从providerCache中查找是否有这个方法
    // 3、有的话，使用invoke调用它，提取区中的参数（也就是依赖），用getService继续找实例和provider
    // 4、
    
    var providerCache = {}; // 用于储存provider
    var instanceCache = {}; // 用于储存constant
    var loadedModules = {};
    var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m; // 判断是否是函数的正则
    var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/; // 去除空格 两边下划线
    var STRIP_COMMENTS = /(\/\/.*$)|(\/\*.*?\*\/)/mg; // 去除注释
    var INSTANTIATING = {};
    
    // $provid与_invokeQueue相对应
    var $provide = {
        constant: function(key, value) {
            if (key === 'hasOwnProperty') {
                throw 'hasOwnProperty is not a valid constant name!';
            }
            // cache[key] = value;  // 用instanceCache替换cache
            instanceCache[key] = value;
        },
        provider: function(key, provider) {
            // cache[key] = invoke(provider.$get, provider); // 用providerCache替换
            // provider的key命名时后面都要加 'Provider' 字符串
            providerCache[key + 'Provider'] = provider;
        }
    };

    // 区分2种cache
    function getService(name) {
        // 先判断有没有实例cache
        if (instanceCache.hasOwnProperty(name)) {
            if (instanceCache[name] === INSTANTIATING) {
                throw new Error('Circular dependency found');
            }
            return instanceCache[name];
            //再判断有没有providerCache
        } else if (providerCache.hasOwnProperty(name + 'Provider')) {
            // 第一次进入时provider都没有实例化
            // aProvider、bProvider、cProvider ：getService('a');instanceCache[a]=INSTANTIATING  —-依赖—>   b  -->  invoke(bProvider.$get)
            //  --> getService('b');instanceCache[b]=INSTANTIATING
            // 同理得getService('c');instanceCache[c]=INSTANTIATING
            // 死循环的时候，第二次循环会判断instanceCache存在，进入上面循环
            // 如果存在的实例等于这个假实例的时候，判断为死循环，throw Error
            instanceCache[name] = INSTANTIATING;
            var provider = providerCache[name + 'Provider'];
            var instance = instanceCache[name] = invoke(provider.$get);
            return instance;
        }
    }

    // 兼容Array Like ['a','b',function(){}]，返回参数
    function annotate(fn) {
        // 数组类型
        if (_.isArray(fn)) {
            return fn.slice(0, fn.length - 1);
        } else if (fn.$inject) {
            return fn.$inject;
        } else if (!fn.length) {
            return [];
        } else {
            var source = fn.toString().replace(STRIP_COMMENTS, '');
            var argDeclaration = source.match(FN_ARGS);
            return _.map(argDeclaration[1].split(','), function(argName) {
                return argName.match(FN_ARG)[2];
            });
        }
    }

    // Injector调用函数fn，并使用locals覆盖cache中的参数key value
    function invoke(fn, self, locals) {
        // 遍历fn.$inject（fn的执行参数），放入cache
        var args = _.map(annotate(fn) /* fn.$inject  invoke和annotate合体*/ , function(token) {
            if (_.isString(token)) {
                // 如果locals中有token就用locals中的值
                return locals && locals.hasOwnProperty(token) ?
                    locals[token] :
                    getService(token);
            } else {
                throw 'Incorrect injection token! Expected a string, got' + token;
            }
        });
        if (_.isArray(fn)) {
            fn = _.last(fn);
        }
        // 绑定this
        return fn.apply(self, args);
    }

    // 兼容构造函数
    function instantiate(Type, locals) {
        var UnwrappedType = _.isArray(Type) ? _.last(Type) : Type;
        var instance = Object.create(UnwrappedType.prototype);
        invoke(Type, instance, locals);
        return instance;
    }

    _.forEach(modulesToLoad, function loadModule(moduleName) {
        // 已经加载过的模块不会重复加载
        if (!loadedModules.hasOwnProperty(moduleName)) {
            loadedModules[moduleName] = true;
            var module = angular.module(moduleName);
            // 有依赖的模块，递归
            _.forEach(module.requires, loadModule);
            _.forEach(module._invokeQueue, function(invokeArgs) {
                var method = invokeArgs[0]; // 第一个参数为方法名字
                var args = invokeArgs[1]; // 第二个参数是[key,value]数组
                $provide[method].apply($provide, args);
            });
        }
    });
    return {
        has: function(key) {
            return instanceCache.hasOwnProperty(key) ||
                providerCache.hasOwnProperty(key + 'Provider');
        },
        get: getService,
        invoke: invoke,
        annotate: annotate,
        instantiate: instantiate
    };
}