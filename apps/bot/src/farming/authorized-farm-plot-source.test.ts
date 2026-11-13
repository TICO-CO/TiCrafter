import type { SkillFarmPlot } from '@ticrafter/skills';
import { describe, expect, it } from 'bun:test';

import { AuthorizedFarmPlotSource } from './authorized-farm-plot-source.js';

const plot: SkillFarmPlot = {
    id: 'farm.1',
    bbox: { min: { x: 0, y: 63, z: 0 }, max: { x: 2, y: 64, z: 2 } },
};

describe('AuthorizedFarmPlotSource', () => {
    it('revalidates and consumes one grant', () => {
        let permitted = true;
        let permitCount = 0;
        const source = new AuthorizedFarmPlotSource(
            { getPlot: () => [plot, null] },
            {
                isPermitted: () => permitted,
                consume: () => {
                    permitCount += 1;
                    permitted = false;
                    return true;
                },
            },
        );
        expect(source.getPlot('farm.1')[0]).toEqual(plot);
        expect(permitCount).toBe(1);
        const [denied, error] = source.getPlot('farm.1');
        expect(denied).toBeNull();
        expect(error?.includes('not permitted')).toBe(true);
    });
});
