import hashlib
import pathlib
import re

ROOT = pathlib.Path('.')
EXT = {'.css', '.jsx', '.tsx', '.js', '.ts', '.html'}
SKIP = {'node_modules', '.git', 'dist', 'build', 'coverage'}
EXCLUDE = {'theme-system.css', 'theme-legacy-vars.css'}

files = [
    p for p in ROOT.rglob('*')
    if p.is_file()
    and p.suffix in EXT
    and p.name not in EXCLUDE
    and not any(part in SKIP for part in p.parts)
]

color_re = re.compile(r'(?i)(#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b)')
prop_re = re.compile(
    r'(?i)(\b(?:color|background(?:-color)?|border(?:-color)?|outline-color|text-decoration-color)\s*:\s*)([^;{}]+)'
)
inline_re = re.compile(
    r'(?i)(style\s*=\s*["\'][^"\']*\b(?:color|background(?:-color)?)\s*:\s*)([^;"\']+)'
)

def var_name(color):
    slug = re.sub(r'[^a-z0-9]+', '-', color.lower()).strip('-') or 'color'
    digest = hashlib.sha1(color.lower().encode()).hexdigest()[:8]
    return f'--legacy-{slug}-{digest}'

def rgb(color):
    c = color.lower()
    if c == 'white': return (255, 255, 255)
    if c == 'black': return (0, 0, 0)
    if not c.startswith('#'): return None
    h = c[1:]
    if len(h) in (3, 4): h = ''.join(ch * 2 for ch in h)
    if len(h) < 6: return None
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def light_variant(color):
    value = rgb(color)
    if value is None:
        return color
    if max(value) - min(value) < 12:
        if color.lower() == 'black': return '#ffffff'
        if color.lower() == 'white': return '#111111'
        return '#%02x%02x%02x' % tuple(255 - x for x in value)
    return color

colors = set()
for path in files:
    text = path.read_text(encoding='utf-8', errors='ignore')
    colors.update(m.group(1) for m in color_re.finditer(text))

mapping = {color: var_name(color) for color in sorted(colors, key=str.lower)}

def replace_declarations(text):
    def declaration(match):
        value = match.group(2)
        value = color_re.sub(lambda m: f'var({mapping[m.group(1)]})', value)
        return match.group(1) + value

    text = prop_re.sub(declaration, text)

    def inline(match):
        value = match.group(2)
        value = color_re.sub(lambda m: f'var({mapping[m.group(1)]})', value)
        return match.group(1) + value

    return inline_re.sub(inline, text)

for path in files:
    old = path.read_text(encoding='utf-8', errors='ignore')
    new = replace_declarations(old)
    # Tailwind extreme neutral utilities are theme-bound rather than literal colors.
    new = new.replace('bg-white', 'bg-[var(--card-bg)]')
    new = new.replace('bg-black', 'bg-[var(--bg-color)]')
    new = new.replace('text-white', 'text-[var(--text-color)]')
    new = new.replace('text-black', 'text-[var(--text-color)]')
    new = new.replace('border-white', 'border-[var(--border-color)]')
    new = new.replace('border-black', 'border-[var(--border-color)]')
    if new != old:
        path.write_text(new, encoding='utf-8')

legacy = ROOT / 'theme-legacy-vars.css'
content = [
    '/* Legacy color bridge: source color literals are represented by theme variables. */',
    ':root {'
]
for color, variable in mapping.items():
    content.append(f'  {variable}: {light_variant(color)};')
content += ['}', '', '@media (prefers-color-scheme: dark) {', '  :root {']
for color, variable in mapping.items():
    content.append(f'    {variable}: {color};')
content += ['  }', '}','']
legacy.write_text('\n'.join(content), encoding='utf-8')

main = ROOT / 'main.jsx'
if main.exists():
    text = main.read_text(encoding='utf-8')
    if "import './theme-legacy-vars.css';" not in text:
        text = text.replace("import './theme-system.js';", "import './theme-legacy-vars.css';\nimport './theme-system.js';")
    text = text.replace("import './theme-final-hardening.css';\n", '')
    main.write_text(text, encoding='utf-8')
