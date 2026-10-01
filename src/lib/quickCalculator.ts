import { currencyExponent } from './money'
type Fraction = { n: bigint; d: bigint }
/** Small decimal-expression parser. Money is rounded once, in minor units. */
export function calculateQuickAmount(expression: string, currency: string): string {
  const source = expression.replace(/\s/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
  if (!source || source.length > 120) throw new Error('Invalid expression')
  const tokens = source.match(/\d+(?:\.\d*)?|\.\d+|[+\-*/()%]/g) ?? []
  if (tokens.join('') !== source) throw new Error('Invalid expression')
  let position = 0
  const combine = (a: Fraction,b: Fraction,op: string): Fraction => {
    if (op === '+') return {n:a.n*b.d+b.n*a.d,d:a.d*b.d}
    if (op === '-') return {n:a.n*b.d-b.n*a.d,d:a.d*b.d}
    if (op === '*') return {n:a.n*b.n,d:a.d*b.d}
    if (b.n === 0n) throw new Error('Division by zero')
    const n=a.n*b.d,d=a.d*b.n
    return d<0n ? {n:-n,d:-d} : {n,d}
  }
  const factor = (): Fraction => {
    const token=tokens[position++]
    let value: Fraction
    if (token === '+' || token === '-') {const v=factor();value={n:token==='-' ? -v.n : v.n,d:v.d}}
    else if (token === '(') {value=sum();if(tokens[position++]!==')') throw new Error('Missing parenthesis')}
    else {if(!token || !/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token) || token.length>18) throw new Error('Invalid number');const [whole,decimal='']=token.split('.');value={n:BigInt((whole || '0')+decimal),d:10n**BigInt(decimal.length)}}
    while(tokens[position]==='%'){position++;value={n:value.n,d:value.d*100n}}
    return value
  }
  const product = (): Fraction => {let v=factor();while(tokens[position]==='*'||tokens[position]==='/'){const op=tokens[position++];v=combine(v,factor(),op)}return v}
  const sum = (): Fraction => {let v=product();while(tokens[position]==='+'||tokens[position]==='-'){const op=tokens[position++];v=combine(v,product(),op)}return v}
  const result=sum()
  if(position!==tokens.length || result.n<0n) throw new Error('Invalid amount')
  const exponent=currencyExponent(currency),scale=10n**BigInt(exponent)
  const minor=(result.n*scale*2n+result.d)/(result.d*2n)
  if(minor>BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Amount too large')
  return exponent ? `${minor/scale}.${String(minor%scale).padStart(exponent,'0')}` : String(minor)
}
