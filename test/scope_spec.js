'use strict';

describe("Scope", function() {
    it("can be constructed and used as an object", function() {
        var scope = new Scope();
        scope.aProperty = 1;
        expect(scope.aProperty).toBe(1);
    });
});

describe("digest", function() {
    var scope;
    beforeEach(function() {
        scope = new Scope();
    });
    it("calls the listener function of a watch on first $digest", function() {
        var watchFn = function() { return 'wat'; };
        var listenerFn = jasmine.createSpy();
        scope.$watch(watchFn, listenerFn);
        scope.$digest();
        expect(listenerFn).toHaveBeenCalled();
    });

    it("calls the listener function when the watched value changes", function() {
        scope.someValue = 'a';
        scope.counter = 0;
        scope.$watch(
            function(scope) { return scope.someValue; },
            function(newValue, oldValue, scope) { scope.counter++; }
        );

        scope.$watch(
            function(scope) { return scope.counter; },
            function(newValue, oldValue, scope) {}
        );

        expect(scope.counter).toBe(0);
        scope.$digest();
        expect(scope.counter).toBe(1);
        scope.$digest();
        expect(scope.counter).toBe(1);
        scope.someValue = 'b';
        expect(scope.counter).toBe(1);
        scope.$digest();
        expect(scope.counter).toBe(2);
    });

    it("triggers chained watchers in the same digest", function() {
        scope.name = 'Jane';
        scope.$watch(
            function(scope) {
                return scope.nameUpper;
            },
            function(newValue, oldValue, scope) {
                if (newValue) {
                    scope.initial = newValue.substring(0, 1) + '.';
                }
            }
        );
        scope.$watch(
            function(scope) {
                return scope.name;
            },
            function(newValue, oldValue, scope) {
                if (newValue) {
                    scope.nameUpper = newValue.toUpperCase();
                }
            }
        );
        scope.$digest();
        expect(scope.initial).toBe('J.');
        scope.name = 'Bob';
        scope.$digest();
        expect(scope.initial).toBe('B.');
    });

    it("does not end digest so that new watches are not run", function() {
        scope.aValue = 'abc';
        scope.counter = 0;
        scope.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
                scope.$watch(
                    function(scope) { return scope.aValue; },
                    function(newValue, oldValue, scope) { scope.counter++; }
                );
            }
        );
        scope.$digest();
        expect(scope.counter).toBe(1);
    });

    it("compares based on value if enabled", function() {
        scope.aValue = [1, 2, 3];
        scope.counter = 0;
        scope.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) { scope.counter++; },
            true
        );
        scope.$digest();
        expect(scope.counter).toBe(1);
        scope.aValue.push(4);
        scope.$digest();
        expect(scope.counter).toBe(2);
    });

});

describe("Inheritance", function() {
    it("watch property in the parent", function() {
        var parent = new Scope();
        var child = parent.$new();
        parent.aValue = [1, 2, 3];
        child.counter = 0;
        child.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) { scope.counter++; },
            true
        );
        child.$digest();
        expect(child.counter).toBe(1);
        parent.aValue.push(4);
        child.$digest();
        expect(child.counter).toBe(2);
    });

    it("can be nested at any depth", function() {
        var a = new Scope();
        var aa = a.$new();
        var aaa = aa.$new();
        var aab = aa.$new();
        var ab = a.$new();
        var abb = ab.$new();

        a.value = 1;

        expect(aa.value).toBe(1);
        expect(aaa.value).toBe(1);
        expect(aab.value).toBe(1);
        expect(ab.value).toBe(1);
        expect(abb.value).toBe(1);

        ab.anotherValue = 2;
        expect(abb.anotherValue).toBe(2);
        expect(aa.anotherValue).toBeUndefined();
        expect(aaa.anotherValue).toBeUndefined();
    });

    // 隔离watch测试
    it("does not digest its parent(s)", function() {
        var parent = new Scope();
        var child = parent.$new();
        parent.aValue = 'abc';
        parent.$watch(
            function(scope) {
                console.log(scope);
                return scope.aValue;
            },
            function(newValue, oldValue, scope) {
                console.log(scope);
                scope.aValueWas = newValue;
            }
        );

        child.$digest(); //child $digest parent的watch监控不到
        expect(child.aValueWas).toBeUndefined();
    });

    it("keeps a record of its children", function() {
        var parent = new Scope();
        var child1 = parent.$new();
        var child2 = parent.$new();
        var child2_1 = child2.$new();
        expect(parent.$$children.length).toBe(2);
        expect(parent.$$children[0]).toBe(child1);
        expect(parent.$$children[1]).toBe(child2);
        expect(child1.$$children.length).toBe(0);
        expect(child2.$$children.length).toBe(1);
        expect(child2.$$children[0]).toBe(child2_1);
    });

    it("digests its children", function() {
        var parent = new Scope();
        var child = parent.$new();
        parent.aValue = 'abc';
        child.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
                scope.aValueWas = newValue;
            }
        );
        parent.$digest();
        expect(child.aValueWas).toBe('abc');
    });

    it("digests from root on $apply", function() {
        var parent = new Scope();
        var child = parent.$new();
        var child2 = child.$new();
        parent.aValue = 'abc';
        parent.counter = 0;
        parent.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
                scope.counter++;
            }
        );
        child2.$apply(function(scope) {});
        expect(parent.counter).toBe(1);
    });

    it("digests its isolated children", function() {
        var parent = new Scope();
        var child = parent.$new(true);
        child.aValue = 'abc';
        child.$watch(
            function(scope) { return scope.aValue; },
            function(newValue, oldValue, scope) {
                scope.aValueWas = newValue;
            }
        );
        parent.$digest();
        expect(child.aValueWas).toBe('abc');
    });
});