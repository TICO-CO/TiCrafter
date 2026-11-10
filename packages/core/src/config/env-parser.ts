export class EnvParser {
    static parse(text: string): Record<string, string> {
        const values: Record<string, string> = {};
        for (const rawLine of text.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const withoutExport = line.startsWith('export ') ? line.slice('export '.length) : line;
            const separator = withoutExport.indexOf('=');
            if (separator <= 0) continue;
            const key = withoutExport.slice(0, separator).trim();
            let value = withoutExport.slice(separator + 1).trim();
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            values[key] = value;
        }
        return values;
    }
}
