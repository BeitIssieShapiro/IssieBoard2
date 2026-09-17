/**
 * Renders a calculator expression for the display: Unicode superscripts and
 * subscripts, √/∛ for the root keys, × and ÷ for the operators.
 *
 * Lives outside CalcScreen so it can be tested without loading React Native.
 */
const SUPERSCRIPT: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  '-':'⁻','.':'·','+':'⁺',
};
function toSuperscript(s: string): string {
  return s.split('').map(c => SUPERSCRIPT[c] ?? c).join('');
}

export function formatExpression(expr: string): string {
  return expr
    .replace(/factorial\(([^)]*)\)/g, '$1!')
    // √ / ∛ for the square- and cube-root keys, matching their ²√x / ³√x
    // captions and the √ that Xroot (yroot) renders. These are ordinary
    // one-arg functions, so the radicand keeps its parens — `√(9)+1` stays
    // unambiguous. While the argument is still being typed the paren is
    // left open, as the other function rules here do.
    .replace(/2root\(([^)]*)\)/g, '√($1)')
    .replace(/3root\(([^)]*)\)/g, '∛($1)')
    .replace(/2root\(/g, '√(')
    .replace(/3root\(/g, '∛(')
    // A logarithm's base is a subscript, matching the log₂/log₁₀ key captions.
    // Before the 2^( rule below, so the "2" here is never read as a power. The
    // \b keeps log( from eating the log2(/logy( prefixes; logy( is a template
    // and is rendered separately, so it must pass through untouched.
    .replace(/log2\(/g, 'log₂(')
    .replace(/\blog\(/g, 'log₁₀(')
    .replace(/x\^2/g, '²')
    .replace(/x\^3/g, '³')
    .replace(/x\^\(([^)]*)\)/g, (_, exp) => exp ? `^${exp}` : '^(')
    .replace(/e\^\(([^)]*)\)/g, (_, exp) => exp ? `e${toSuperscript(exp)}` : 'e^(')
    .replace(/10\^\(([^)]*)\)/g, (_, exp) => exp ? `10${toSuperscript(exp)}` : '10^(')
    .replace(/2\^\(([^)]*)\)/g, (_, exp) => exp ? `2${toSuperscript(exp)}` : '2^(')
    .replace(/1\/\(([^)]*)\)/g, (_, x) => x ? `(1/${x})` : '1/(')
    .replace(/\bpi\b/g, 'π')
    .replace(/\*/g, '×')
    .replace(/\//g, '÷');
}

