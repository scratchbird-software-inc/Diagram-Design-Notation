/** Bounded text formatting. Raw HTML and executable destinations are never interpreted. */
export interface InlineRun {
    readonly text: string;
    readonly bold?: boolean;
    readonly italic?: boolean;
    readonly underline?: boolean;
    readonly code?: boolean;
    readonly href?: string;
}
export interface TextBlock {
    readonly runs: readonly InlineRun[];
    readonly heading: number;
    readonly list: boolean;
    readonly quote: boolean;
    readonly code: boolean;
}
export function safeURL(value: string): string | undefined {
    try {
        const url = new URL(value);
        return ['https:', 'http:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
    }
    catch {
        return undefined;
    }
}
export function inlineMarkdown(text: string, depth = 0): InlineRun[] {
    if (depth > 8)
        return [{ text }];
    const runs: InlineRun[] = [];
    let start = 0;
    const matcher = /(\*\*|__|\+\+|\*|_|`)(.+?)\1|\[([^\]]+)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(text))) {
        if (match.index > start)
            runs.push({ text: text.slice(start, match.index) });
        if (match[3] !== undefined) {
            const href = safeURL(match[4] ?? '');
            runs.push(href ? { text: match[3], href } : { text: match[3] });
        }
        else {
            const marker = match[1];
            const children = marker === '`' ? [{ text: match[2] ?? '' }] : inlineMarkdown(match[2] ?? '', depth + 1);
            for (const run of children)
                runs.push({ ...run, ...(marker === '**' || marker === '__' ? { bold: true } : marker === '++' ? { underline: true } : marker === '`' ? { code: true } : { italic: true }) });
        }
        start = matcher.lastIndex;
    }
    if (start < text.length || !runs.length)
        runs.push({ text: text.slice(start) });
    return runs;
}
export function markdownBlocks(text: string, formatted = true): TextBlock[] {
    if (!formatted)
        return text.split(/\r?\n/).map(line => ({ runs: [{ text: line }], heading: 0, list: false, quote: false, code: false }));
    const blocks: TextBlock[] = [];
    let paragraph: string[] = [];
    let code = false;
    const flush = () => {
        if (paragraph.length) {
            blocks.push({ runs: inlineMarkdown(paragraph.join(' ')), heading: 0, list: false, quote: false, code: false });
            paragraph = [];
        }
    };
    for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
        if (/^\s*```/.test(line)) {
            flush();
            code = !code;
            continue;
        }
        if (code) {
            blocks.push({ runs: [{ text: line, code: true }], heading: 0, list: false, quote: false, code: true });
            continue;
        }
        if (!line.trim()) {
            flush();
            blocks.push({ runs: [{ text: '' }], heading: 0, list: false, quote: false, code: false });
            continue;
        }
        const heading = /^(#{1,6})\s*(.*)$/.exec(line);
        const list = /^\s*(?:[-*+] |\d+\. )(.*)$/.exec(line);
        const quote = /^\s*>\s?(.*)$/.exec(line);
        if (heading || list || quote) {
            flush();
            blocks.push({ runs: inlineMarkdown(heading?.[2] ?? list?.[1] ?? quote?.[1] ?? ''), heading: heading?.[1]?.length ?? 0, list: !!list, quote: !!quote, code: false });
        }
        else
            paragraph.push(line.trim());
    }
    flush();
    return blocks;
}
