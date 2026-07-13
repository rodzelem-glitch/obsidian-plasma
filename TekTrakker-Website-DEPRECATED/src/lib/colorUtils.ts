export function generateColorShades(baseHex: string): Record<string, string> {
    if (!baseHex.match(/^#?[0-9A-Fa-f]{6}$/)) return {};
    const hex = baseHex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    const calcShade = (factor: number) => {
        const newR = Math.min(255, Math.max(0, Math.round(r + (255 - r) * factor)));
        const newG = Math.min(255, Math.max(0, Math.round(g + (255 - g) * factor)));
        const newB = Math.min(255, Math.max(0, Math.round(b + (255 - b) * factor)));
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };

    const calcDark = (factor: number) => {
        const newR = Math.max(0, Math.round(r * (1 - factor)));
        const newG = Math.max(0, Math.round(g * (1 - factor)));
        const newB = Math.max(0, Math.round(b * (1 - factor)));
        return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };

    return {
        '50': calcShade(0.95),
        '100': calcShade(0.9),
        '200': calcShade(0.7),
        '300': calcShade(0.5),
        '400': calcShade(0.2),
        '500': `#${hex}`,
        '600': calcDark(0.2),
        '700': calcDark(0.4),
        '800': calcDark(0.6),
        '900': calcDark(0.8),
        '950': calcDark(0.9),
    };
}
