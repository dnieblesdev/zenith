from playwright.sync_api import sync_playwright

def inspect():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        url = "https://novelfire.net/book/magnate-tycoon-how-did-simply-enjoying-life-make-me-a-male-god"
        print(f"Navigating to {url}")
        page.goto(url, timeout=60000)
        
        # Check header-stats
        header_stats = page.locator(".header-stats").first
        if header_stats.is_visible():
            print("Found .header-stats:")
            print(header_stats.inner_html())
        else:
            print(".header-stats NOT found")

        # Search for "Genre"
        print("Searching for 'Genre'...")
        genre_elements = page.locator("*:has-text('Genre')").all()
        for i, el in enumerate(genre_elements[:5]): # Limit to first 5
            print(f"Match {i}: {el.inner_html()[:200]}...")

        # Check novel-info
        novel_info = page.locator(".novel-info").first
        if novel_info.is_visible():
            print("Found .novel-info:")
            print(novel_info.inner_html()[:500]) # Truncate
        else:
            print(".novel-info NOT found")

        # Search for elements with class containing 'genre' or 'cat'
        print("Searching for class *genre* or *cat*...")
        elements = page.locator("[class*='genre'], [class*='cat']").all()
        for i, el in enumerate(elements):
             if i > 10: break
             print(f"Class match {i}: {el.get_attribute('class')}")
             print(f"HTML: {el.evaluate('el => el.outerHTML')[:200]}...")
             print("-" * 20)
            
        browser.close()

if __name__ == "__main__":
    inspect()
