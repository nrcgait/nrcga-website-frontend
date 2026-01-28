// Front Page Configuration
// Edit this file to update the carousel and breaking news popup on the homepage
//
// CAROUSEL STRUCTURE:
// - image_url: URL to the image (required)
// - alt_text: Alt text for accessibility (required)
// - link_url: Optional URL to link the image to (can be null or empty string)
// - display_order: Order in which images appear (lower numbers appear first, optional)
// - active: Whether the image is active/visible (1 = active, 0 = inactive, optional, defaults to 1)
//
// BREAKING NEWS STRUCTURE:
// - active: Whether the popup is enabled (true = show, false = hide, optional, defaults to false)
// - title: Title/headline for the breaking news (required if active is true)
// - content: Main text content of the breaking news (required if active is true)
// - image_url: Optional image URL to display in the popup (optional)
// - read_more_url: Optional URL for "Read More" button (optional)
// - storage_key: Unique identifier for localStorage (prevents showing again if dismissed, optional)

window.frontPageConfig = {
    // Carousel Images
    carousel: [
        {
            image_url: "https://storage.googleapis.com/nodeodm-outputs-v1/outputs/WILD_HORSE_35202ad3/images/DJI_20250526135552_0040_V.JPG",
            alt_text: "yes",
            link_url: "marks from above",
            display_order: 0,
            active: 1
        },
        {
            image_url: "https://storage.googleapis.com/nodeodm-outputs-v1/outputs/WILD_HORSE_35202ad3/images/DJI_20250526135604_0052_V.JPG",
            alt_text: "2",
            link_url: null,
            display_order: 0,
            active: 1
        },
        {
            image_url: "https://storage.googleapis.com/nodeodm-outputs-v1/outputs/F1_LasVegas_EntranceArea_fef5a2bb/images/DJI_20251023142528_0005_V.JPG",
            alt_text: "yht",
            link_url: null,
            display_order: 0,
            active: 1
        },
        {
            image_url: "https://storage.googleapis.com/nodeodm-outputs-v1/outputs/Atlas_Geospatial_1601_W_Charleston_Las_Vegas/images/DJI_20251112114558_0041_V.JPG",
            alt_text: "bum",
            link_url: null,
            display_order: 0,
            active: 1
        }
    ],
    
    // Breaking News Popup
    breakingNews: {
        active: true,
        title: "Breaking News!",
        content: "Stay tuned for important updates from NRCGA.",
        image_url: null,
        read_more_url: null,
        storage_key: "nrcga_breaking_news_dismissed"
    }
};

