const { chromium } = require("playwright");

async function main() {
  var browser = await chromium.launch({ headless: true });
  var page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);

  try {
    await page.goto("http://localhost:3000/settings", { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(6000);

    // Click Dad user card
    await page.locator("text=Dad").first().click().catch(function() {});
    await page.waitForTimeout(1000);

    // Click Unlock
    await page.locator("button:has-text('Unlock')").first().click().catch(function() {});
    await page.waitForTimeout(1000);

    // Enter PIN 1234 - use type() instead of fill()
    var pinInput = page.locator("[role='dialog'] input[type='text'], [role='dialog'] input[type='password'], [role='dialog'] input[type='tel'], [role='dialog'] input[type='number']").first();
    if (await pinInput.isVisible().catch(function() { return false; })) {
      await pinInput.click();
      await pinInput.type("1234");
      await page.waitForTimeout(300);
      await page.locator("button:has-text('Verify')").first().click().catch(function() {});
      await page.waitForTimeout(2000);
      console.log("PIN entered and verified");
    }

    await page.screenshot({ path: ".playwright-mcp/feat-205-after-unlock.png" });
    console.log("Screenshot 1: After unlock");

    // Click Photos tab
    await page.locator("button:has-text('Photos')").first().click().catch(function() {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: ".playwright-mcp/feat-205-photos-tab.png" });
    console.log("Screenshot 2: Photos tab with icons");

    // Find edit button - try using aria-label attribute
    var allButtons = page.locator("button");
    var btnCount = await allButtons.count();
    var clicked = false;
    for (var i = 0; i < btnCount && !clicked; i++) {
      var ariaLabel = await allButtons.nth(i).getAttribute("aria-label").catch(function() { return ""; });
      if (ariaLabel && ariaLabel.toLowerCase().indexOf("edit") >= 0) {
        console.log("Found edit button with aria-label: " + ariaLabel);
        await allButtons.nth(i).click();
        clicked = true;
      }
    }

    if (clicked) {
      await page.waitForTimeout(5000);
      await page.screenshot({ path: ".playwright-mcp/feat-184-edit-dialog-top.png" });
      console.log("Screenshot 3: Edit dialog top");

      // Scroll dialog to albums section
      await page.evaluate(function() {
        var els = document.querySelectorAll(".overflow-y-auto");
        for (var i = 0; i < els.length; i++) { els[i].scrollTop = 500; }
      });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: ".playwright-mcp/feat-184-album-thumbnails.png" });
      console.log("Screenshot 4: Album thumbnails");

      // Scroll to bottom for people selector
      await page.evaluate(function() {
        var els = document.querySelectorAll(".overflow-y-auto");
        for (var i = 0; i < els.length; i++) { els[i].scrollTop = els[i].scrollHeight; }
      });
      await page.waitForTimeout(4000);
      await page.screenshot({ path: ".playwright-mcp/feat-192-people-thumbnails.png" });
      console.log("Screenshot 5: People face thumbnails");

      // Close dialog
      await page.locator("button:has-text('Cancel')").first().click().catch(function() {});
      await page.waitForTimeout(500);
    } else {
      console.log("Could not find edit button");
    }

    // Screensaver section
    var ssHeading = page.locator("text=Screensaver Settings").first();
    if (await ssHeading.isVisible().catch(function() { return false; })) {
      await ssHeading.scrollIntoViewIfNeeded();
      await page.waitForTimeout(4000);
      await page.screenshot({ path: ".playwright-mcp/feat-205-screensaver.png" });
      console.log("Screenshot 6: Screensaver section");

      await page.evaluate(function() { window.scrollBy(0, 600); });
      await page.waitForTimeout(3000);
      await page.screenshot({ path: ".playwright-mcp/feat-192-screensaver-people.png" });
      console.log("Screenshot 7: Screensaver people section");
    }

  } catch(err) {
    console.error("Error: " + err.message);
    await page.screenshot({ path: ".playwright-mcp/feat-error.png" }).catch(function() {});
  }

  await browser.close();
  console.log("Done!");
}

main().catch(console.error);
