'use strict';

function parse(expr) {
    var lexer = new Lexer();
    var parser = new Parser(lexer);
    return parser.parse(expr);
}

// Lexer
function Lexer() {

}
// 遍历text输入字符串的每个字符
Lexer.prototype.lex = function(text) {
    this.text = text;
    this.index = 0;
    this.ch = undefined;
    this.tokens = [];

    this.readNumber();

    return this.tokens;
};
// 判断char是不是数字
Lexer.prototype.isNumber = function(ch) {
    /**
     * javascript字符串对比原则：
     * 1、有长度大于没长度
     * 2、都有长度，从首位开始逐个char比较，一旦比出大小就停止
     * 3、char比较大小原则，用char对应的charCode比较
     * *、String.charCodeAt(index);类似charAt(index)，不同的charCodeAt是返回的是该字符的charCode
     */
    return '0' <= ch && ch <= '9';
};
Lexer.prototype.readNumber = function() {
    var number = '';
    while (this.index < this.text.length) {
        var ch = this.text.charAt(this.index).toLowerCase();
        // 是有效数字就拼接到number字符串里返回，出现非数字的部分有3种情况下是数字
        if (ch === '.' || this.isNumber(ch)) {
            number += ch;
        } else {
            var nextCh = this.peek(); // 下一位字符
            var prevCh = number.charAt(number.length - 1); // 前一位字符
            // 情况一：
            if (ch === 'e' && this.isExpOperator(nextCh)) {
                number += ch;
            } else if (this.isExpOperator(ch) && prevCh === 'e' &&
                nextCh && this.isNumber(nextCh)) {
                number += ch;
            } else if (this.isExpOperator(ch) && prevCh === 'e' && (!nextCh || !this.isNumber(nextCh))) {
                throw "Invalid exponent";
            } else {
                break;
            }
        }
        this.index++;
    }
    this.tokens.push({
        text: number, // result Sting
        value: Number(number) // result Number
    });
};
Lexer.prototype.isExpOperator = function(ch) {
    if (ch === '-' || ch === '+') {
        return true;
    }
    return false;
}
Lexer.prototype.peek = function() {
    // 如果不是最后一个元素，返回下一个元素，否则返回false
    return this.index < this.text.length - 1 ?
        this.text.charAt(this.index + 1) :
        false;
};

/**
 * AST是一个复杂的js object结构，是一个树装的表结构；
 * 树中的每个Node都有一个type表示这个Node的句法结构；
 * 为了补充type，Node还有一个type-specific属性，保存着更多Node的信息
 * 每个 AST 都有一个root node，root node的type是AST.Program
 * @param {*} lexer 
 */
function AST(lexer) {
    this.lexer = lexer;
}
AST.Program = 'Program';
AST.Literal = 'Literal';

AST.prototype.ast = function(text) {
    this.tokens = this.lexer.lex(text);
    return this.program(); // 顶部节点，称为Program Node
};
AST.prototype.program = function() {
    return {
        type: AST.Program,
        body: this.constant()
    };
};
AST.prototype.constant = function() {
    return { type: AST.Literal, value: this.tokens[0].value };
};

// AST Compiler
function ASTCompiler(astBuilder) {
    this.astBuilder = astBuilder;
}

ASTCompiler.prototype.compile = function(text) {
    var ast = this.astBuilder.ast(text);
    console.log('AST:', ast);
    this.state = { body: [] };
    this.recurse(ast);
    /* jshint -W054 */
    return new Function(this.state.body.join(''));
    /* jshint -W054 */
};
/**
 * 接受ast树，如果是ProgramNode，递归到ast.body
 */
ASTCompiler.prototype.recurse = function(ast) {
    switch (ast.type) {
        case AST.Program:
            this.state.body.push('return ', this.recurse(ast.body), ';');
            break;
        case AST.Literal:
            return ast.value;
    }
};

// Parser
function Parser(lexer) {
    this.lexer = lexer;
    this.ast = new AST(this.lexer);
    this.astCompiler = new ASTCompiler(this.ast);
}
Parser.prototype.parse = function(text) {
    return this.astCompiler.compile(text);
};