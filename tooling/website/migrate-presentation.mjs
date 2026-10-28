/** Offline conversion of inspected presentation values, never a browser parser
 * or a second runtime dialect. The returned object is an appearance override. */
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const own = (value, key) => Object.hasOwn(object(value), key);
const units = { px: 1, pt: 96 / 72, mm: 96 / 25.4, cm: 96 / 2.54, in: 96 };
const length = value => typeof value === 'number' ? value : typeof value?.$quantity === 'number' && own(units, value.unit ?? 'px') ? value.$quantity * units[value.unit ?? 'px'] : undefined;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const merge = (base, override) => {
    const result = { ...base };
    for (const [key, value] of Object.entries(override)) result[key] = Object.keys(object(value)).length ? merge(object(base[key]), value) : value;
    return result;
};
const rename = (value, names) => names[value] ?? value;

function textProperties(input) {
    const result = {};
    for (const key of ['color', 'italic', 'decoration', 'line_height', 'metrics']) if (own(input, key)) result[key] = input[key];
    if (own(input, 'weight')) result.weight = rename(input.weight, { normal: 400, bold: 700 });
    if (own(input, 'variant')) result.variant = rename(input.variant, { 'small-caps': 'small_caps' });
    if (own(input, 'align')) result.align = rename(input.align, { left: 'start', right: 'end', middle: 'center' });
    for (const key of ['max_width', 'max_height', 'min_font']) if (finite(length(input[key]))) result[key] = length(input[key]);
    if (own(input, 'fit')) result.fit = input.fit;
    if (own(input, 'roles')) result.roles = Object.fromEntries(Object.entries(object(input.roles)).map(([role, settings]) => {
        const run = textProperties(settings);
        if (typeof settings.font === 'string') run.font = settings.font;
        if (finite(length(settings.size))) run.size = length(settings.size);
        return [role, run];
    }));
    return result;
}
function styleProperties(input) {
    const result = {};
    for (const key of ['theme', 'font', 'seed', 'roughness', 'hachure', 'paper']) if (own(input, key)) result[key] = input[key];
    if (own(input, 'look')) result.look = rename(input.look, { handDrawn: 'handdrawn' });
    if (finite(length(input.font_size))) result.font_size = length(input.font_size);
    return result;
}
function sizingAndText(input) {
    const text = textProperties(object(input.text));
    for (const [key, target] of Object.entries({ text_fit: 'fit', max_width: 'max_width', max_height: 'max_height', min_font: 'min_font' })) {
        const value = key === 'text_fit' ? input[key] : length(input[key]);
        if (value !== undefined) text[target] = value;
    }
    return Object.keys(text).length ? { text } : {};
}
function size(value) {
    const width = length(Array.isArray(value) ? value[0] : value?.width), height = length(Array.isArray(value) ? value[1] : value?.height);
    return finite(width) && finite(height) ? { width, height } : undefined;
}
function presentationLayer(input, relation) {
    const result = sizingAndText(input), style = styleProperties(object(input.style));
    if (Object.keys(style).length) result.style = style;
    // The old nested style.text and flat element bounds use the same per-key
    // precedence, without copying resolved view defaults onto every occurrence.
    const nested = sizingAndText(object(input.style));
    if (nested.text) result.text = merge(nested.text, result.text ?? {});
    if (typeof input.fill === 'string') result.background = { color: input.fill };
    if (finite(input.opacity)) result.opacity = input.opacity;
    const pen = object(relation ? input.line : input.stroke), stroke = {};
    for (const key of ['color', 'dash', 'corners']) if (own(pen, key)) stroke[key] = pen[key];
    if (finite(length(pen.weight))) stroke.weight = length(pen.weight);
    if (Object.keys(stroke).length) {
        result.stroke = stroke;
        if (!relation) {
            result.border = {};
            for (const [from, to] of [['color', 'color'], ['weight', 'width'], ['dash', 'style']]) if (own(stroke, from)) result.border[to] = stroke[from];
            if (!Object.keys(result.border).length) delete result.border;
        }
    }
    for (const key of ['size', 'min_size', 'max_size']) {
        const converted = size(input[key]);
        if (converted) result[key] = converted;
        else if (input[key] === 'auto' && key !== 'min_size') result[key] = 'auto';
    }
    if (input.shadow === null) result.shadow = null;
    else if (input.shadow && typeof input.shadow === 'object') {
        const shadow = {};
        for (const key of ['kind', 'color', 'opacity']) if (own(input.shadow, key)) shadow[key] = input.shadow[key];
        for (const key of ['x', 'y', 'blur', 'spread', 'lift']) if (finite(length(input.shadow[key]))) shadow[key] = length(input.shadow[key]);
        if (Object.keys(shadow).length) result.shadow = shadow;
    }
    return result;
}

/** Element > view per key; an occurrence's explicit settings/size win last.
 * Placement coordinates, body modes, semantic marks and attachments are handled
 * by the graph converter and deliberately do not enter this helper. */
export function convertAppearancePresentation(source = {}, placement = {}, originalView = {}) {
    const relation = !!(source.from && source.to) || source.category === 'relation';
    let result = relation ? { text: textProperties(object(originalView.profiles?.style?.text)) } : sizingAndText(object(originalView.profiles?.style));
    result = merge(result, presentationLayer(object(source.properties), relation));
    result = merge(result, presentationLayer(object(placement.properties), relation));
    result = merge(result, presentationLayer(placement, relation));
    if (!relation && result.text?.fit === undefined && (result.text?.max_width !== undefined || result.size?.width !== undefined)) result.text = { ...result.text, fit: 'wrap' };
    for (const [key, value] of Object.entries(result)) if (value && typeof value === 'object' && !Object.keys(value).length) delete result[key];
    return result;
}
