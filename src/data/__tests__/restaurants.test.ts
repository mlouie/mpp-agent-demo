import { describe, it, expect } from "vitest";
import { restaurants, searchRestaurants, getRestaurantById, computeOrderTotal } from "../restaurants";

describe("restaurants", () => {
  it("has 5 restaurants", () => { expect(restaurants).toHaveLength(5); });
  it("each restaurant has 6-8 menu items", () => {
    for (const r of restaurants) {
      expect(r.menu.length).toBeGreaterThanOrEqual(6);
      expect(r.menu.length).toBeLessThanOrEqual(8);
    }
  });
  it("all prices are between $8 and $25", () => {
    for (const r of restaurants) {
      for (const item of r.menu) {
        expect(item.price).toBeGreaterThanOrEqual(8);
        expect(item.price).toBeLessThanOrEqual(25);
      }
    }
  });
});

describe("searchRestaurants", () => {
  it("filters by cuisine", () => {
    const results = searchRestaurants({ cuisine: "thai" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.cuisine.toLowerCase() === "thai")).toBe(true);
  });
  it("filters by price range", () => {
    const results = searchRestaurants({ priceRange: "$" });
    expect(results.every((r) => r.priceRange === "$")).toBe(true);
  });
  it("returns all restaurants with no filters", () => {
    const results = searchRestaurants({});
    expect(results).toHaveLength(5);
  });
});

describe("getRestaurantById", () => {
  it("returns restaurant when found", () => {
    const r = getRestaurantById("somtum-thai");
    expect(r).toBeDefined();
    expect(r!.name).toBe("Somtum Thai");
  });
  it("returns undefined for unknown id", () => {
    expect(getRestaurantById("nonexistent")).toBeUndefined();
  });
});

describe("computeOrderTotal", () => {
  it("sums selected item prices", () => {
    const total = computeOrderTotal("somtum-thai", ["green-papaya-salad", "pad-thai"]);
    expect(total).toBeGreaterThan(0);
    expect(typeof total).toBe("number");
  });
  it("throws for unknown restaurant", () => {
    expect(() => computeOrderTotal("nonexistent", ["item"])).toThrow();
  });
  it("throws for unknown item", () => {
    expect(() => computeOrderTotal("somtum-thai", ["nonexistent-item"])).toThrow();
  });
});
