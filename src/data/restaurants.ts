import type { Restaurant } from "@/types";

export const restaurants: Restaurant[] = [
  {
    id: "somtum-thai",
    name: "Somtum Thai",
    cuisine: "Thai",
    priceRange: "$$",
    rating: 4.6,
    deliveryTime: "25-35 min",
    menu: [
      {
        id: "green-papaya-salad",
        name: "Green Papaya Salad",
        description: "Shredded green papaya with tomatoes, green beans, peanuts, and lime dressing",
        price: 12,
        tags: ["salad", "spicy", "vegan"],
      },
      {
        id: "pad-thai",
        name: "Pad Thai",
        description: "Stir-fried rice noodles with egg, tofu, bean sprouts, and tamarind sauce",
        price: 16,
        tags: ["noodles", "popular"],
      },
      {
        id: "green-curry",
        name: "Green Curry",
        description: "Creamy coconut green curry with vegetables and jasmine rice",
        price: 17,
        tags: ["curry", "spicy", "coconut"],
      },
      {
        id: "tom-yum-soup",
        name: "Tom Yum Soup",
        description: "Spicy and sour lemongrass soup with mushrooms and galangal",
        price: 14,
        tags: ["soup", "spicy", "lemongrass"],
      },
      {
        id: "mango-sticky-rice",
        name: "Mango Sticky Rice",
        description: "Sweet sticky rice with fresh mango slices and coconut cream",
        price: 10,
        tags: ["dessert", "sweet", "vegan"],
      },
      {
        id: "thai-iced-tea",
        name: "Thai Iced Tea",
        description: "Sweet and creamy orange spiced tea served over ice",
        price: 8,
        tags: ["drink", "sweet"],
      },
      {
        id: "basil-chicken",
        name: "Basil Chicken",
        description: "Stir-fried ground chicken with holy basil, chili, and oyster sauce over rice",
        price: 15,
        tags: ["chicken", "spicy", "basil"],
      },
    ],
  },
  {
    id: "casa-oaxaca",
    name: "Casa Oaxaca",
    cuisine: "Mexican",
    priceRange: "$",
    rating: 4.4,
    deliveryTime: "20-30 min",
    menu: [
      {
        id: "street-tacos",
        name: "Street Tacos",
        description: "Three corn tortilla tacos with carne asada, onion, cilantro, and salsa verde",
        price: 12,
        tags: ["tacos", "popular", "beef"],
      },
      {
        id: "chicken-enchiladas",
        name: "Chicken Enchiladas",
        description: "Rolled corn tortillas filled with chicken and covered in mole negro",
        price: 14,
        tags: ["enchiladas", "chicken", "mole"],
      },
      {
        id: "tlayuda",
        name: "Tlayuda",
        description: "Large crispy tortilla topped with black beans, asiento, quesillo, and tasajo",
        price: 16,
        tags: ["oaxacan", "crispy"],
      },
      {
        id: "guacamole-chips",
        name: "Guacamole & Chips",
        description: "House-made guacamole with fresh tortilla chips and pickled jalapeños",
        price: 9,
        tags: ["appetizer", "vegan", "popular"],
      },
      {
        id: "black-bean-soup",
        name: "Black Bean Soup",
        description: "Rich black bean soup with epazote, cotija cheese, and crema",
        price: 10,
        tags: ["soup", "vegetarian"],
      },
      {
        id: "horchata",
        name: "Horchata",
        description: "Chilled rice milk drink with cinnamon and vanilla",
        price: 8,
        tags: ["drink", "sweet"],
      },
      {
        id: "churros",
        name: "Churros",
        description: "Fried dough pastry dusted with cinnamon sugar, served with chocolate dipping sauce",
        price: 9,
        tags: ["dessert", "sweet"],
      },
    ],
  },
  {
    id: "bella-napoli",
    name: "Bella Napoli",
    cuisine: "Italian",
    priceRange: "$$$",
    rating: 4.8,
    deliveryTime: "35-50 min",
    menu: [
      {
        id: "margherita-pizza",
        name: "Margherita Pizza",
        description: "Neapolitan pizza with San Marzano tomatoes, fresh mozzarella, and basil",
        price: 22,
        tags: ["pizza", "vegetarian", "popular"],
      },
      {
        id: "carbonara",
        name: "Spaghetti Carbonara",
        description: "Spaghetti with guanciale, egg yolk, Pecorino Romano, and black pepper",
        price: 24,
        tags: ["pasta", "pork", "popular"],
      },
      {
        id: "burrata-salad",
        name: "Burrata Salad",
        description: "Creamy burrata with heirloom tomatoes, basil oil, and flaky sea salt",
        price: 18,
        tags: ["salad", "vegetarian"],
      },
      {
        id: "osso-buco",
        name: "Osso Buco",
        description: "Braised veal shanks with gremolata and saffron risotto",
        price: 25,
        tags: ["veal", "braised", "special"],
      },
      {
        id: "tiramisu",
        name: "Tiramisù",
        description: "Classic Italian dessert with espresso-soaked ladyfingers and mascarpone cream",
        price: 12,
        tags: ["dessert", "coffee"],
      },
      {
        id: "bruschetta",
        name: "Bruschetta",
        description: "Grilled bread rubbed with garlic, topped with tomatoes and fresh basil",
        price: 10,
        tags: ["appetizer", "vegan"],
      },
      {
        id: "limoncello",
        name: "Limoncello",
        description: "House-made Italian lemon liqueur served chilled",
        price: 12,
        tags: ["drink", "alcoholic"],
      },
    ],
  },
  {
    id: "sakura-sushi",
    name: "Sakura Sushi",
    cuisine: "Japanese",
    priceRange: "$$$",
    rating: 4.7,
    deliveryTime: "30-45 min",
    menu: [
      {
        id: "salmon-nigiri",
        name: "Salmon Nigiri",
        description: "Two pieces of hand-pressed sushi rice topped with fresh Atlantic salmon",
        price: 14,
        tags: ["sushi", "fish", "popular"],
      },
      {
        id: "spicy-tuna-roll",
        name: "Spicy Tuna Roll",
        description: "Eight-piece roll with spicy tuna, cucumber, and sriracha aioli",
        price: 16,
        tags: ["roll", "spicy", "tuna"],
      },
      {
        id: "dragon-roll",
        name: "Dragon Roll",
        description: "Shrimp tempura roll topped with avocado, tobiko, and eel sauce",
        price: 18,
        tags: ["roll", "shrimp", "popular"],
      },
      {
        id: "miso-soup",
        name: "Miso Soup",
        description: "Traditional dashi broth with white miso, tofu, wakame, and green onion",
        price: 8,
        tags: ["soup", "vegetarian"],
      },
      {
        id: "edamame",
        name: "Edamame",
        description: "Steamed young soybeans lightly salted with sea salt",
        price: 8,
        tags: ["appetizer", "vegan"],
      },
      {
        id: "matcha-ice-cream",
        name: "Matcha Ice Cream",
        description: "Creamy green tea ice cream topped with red bean paste",
        price: 10,
        tags: ["dessert", "sweet"],
      },
      {
        id: "chicken-katsu",
        name: "Chicken Katsu",
        description: "Crispy panko-breaded chicken cutlet with tonkatsu sauce and shredded cabbage",
        price: 17,
        tags: ["chicken", "fried", "popular"],
      },
      {
        id: "gyoza",
        name: "Gyoza",
        description: "Pan-fried pork and cabbage dumplings served with ponzu dipping sauce",
        price: 12,
        tags: ["appetizer", "pork", "fried"],
      },
    ],
  },
  {
    id: "liberty-burger",
    name: "Liberty Burger",
    cuisine: "American",
    priceRange: "$",
    rating: 4.3,
    deliveryTime: "15-25 min",
    menu: [
      {
        id: "classic-cheeseburger",
        name: "Classic Cheeseburger",
        description: "Half-pound beef patty with American cheese, lettuce, tomato, onion, and pickles",
        price: 14,
        tags: ["burger", "beef", "popular"],
      },
      {
        id: "bacon-bbq-burger",
        name: "Bacon BBQ Burger",
        description: "Smash patty with crispy bacon, cheddar, BBQ sauce, and onion rings",
        price: 16,
        tags: ["burger", "beef", "bacon"],
      },
      {
        id: "veggie-burger",
        name: "Veggie Burger",
        description: "Black bean and beet patty with avocado, sprouts, and chipotle mayo",
        price: 13,
        tags: ["burger", "vegetarian"],
      },
      {
        id: "crispy-chicken-sandwich",
        name: "Crispy Chicken Sandwich",
        description: "Buttermilk fried chicken with pickles, coleslaw, and honey mustard on brioche",
        price: 15,
        tags: ["chicken", "sandwich", "popular"],
      },
      {
        id: "cheese-fries",
        name: "Cheese Fries",
        description: "Golden crinkle-cut fries smothered in melted cheddar and jalapeños",
        price: 9,
        tags: ["sides", "popular"],
      },
      {
        id: "vanilla-milkshake",
        name: "Vanilla Milkshake",
        description: "Thick and creamy hand-spun vanilla milkshake",
        price: 8,
        tags: ["drink", "sweet"],
      },
    ],
  },
];

export function searchRestaurants(filters: {
  cuisine?: string;
  priceRange?: "$" | "$$" | "$$$";
}): Restaurant[] {
  return restaurants.filter((r) => {
    if (filters.cuisine && r.cuisine.toLowerCase() !== filters.cuisine.toLowerCase()) {
      return false;
    }
    if (filters.priceRange && r.priceRange !== filters.priceRange) {
      return false;
    }
    return true;
  });
}

export function getRestaurantById(id: string): Restaurant | undefined {
  return restaurants.find((r) => r.id === id);
}

export function computeOrderTotal(restaurantId: string, itemIds: string[]): number {
  const restaurant = getRestaurantById(restaurantId);
  if (!restaurant) {
    throw new Error(`Restaurant not found: ${restaurantId}`);
  }

  return itemIds.reduce((total, itemId) => {
    const item = restaurant.menu.find((m) => m.id === itemId);
    if (!item) {
      throw new Error(`Menu item not found: ${itemId} in restaurant ${restaurantId}`);
    }
    return total + item.price;
  }, 0);
}
