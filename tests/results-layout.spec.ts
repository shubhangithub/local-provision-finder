import {test,expect} from './fixtures';
import { chooseRegion, useCurrentLocation, showView } from './region-helpers';
test('map and service list divider supports dragging and keyboard resizing',async({page})=>{
 test.skip(test.info().project.name==='mobile','Divider is desktop only');
 await page.goto('/');await chooseRegion(page,'Bristol');
 const divider=page.getByRole('separator',{name:'Resize service list and map'});await expect(divider).toBeVisible();const box=await divider.boundingBox();await page.mouse.move(box!.x+box!.width/2,box!.y+40);await page.mouse.down();await page.mouse.move(box!.x+110,box!.y+40);await page.mouse.up();expect(Number(await divider.getAttribute('aria-valuenow'))).toBeGreaterThan(50);
 await divider.focus();await page.keyboard.press('Home');await expect(divider).toHaveAttribute('aria-valuenow','25');await page.keyboard.press('ArrowRight');await expect(divider).toHaveAttribute('aria-valuenow','30');
});
