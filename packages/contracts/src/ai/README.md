# AI contracts

This contract surface introduces public recommendation response/query contracts only. Recommendation scores are advisory ML output, not financial or inventory authority. The browser never sends model weights, recommendation scores, prices, stock, or transactional state to the AI API.

This contract surface adds the smart-pricing advisory response contract: current price, suggested range, server-derived signal summary, model version, timestamp, and `advisory: true`.
