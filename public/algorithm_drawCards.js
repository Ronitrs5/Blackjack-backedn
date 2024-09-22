// deck.js
class Deck {
    constructor() {
        this.cards = this.createDeck();
        this.usedCards = [];
    }

    createDeck() {
        const suits = ['Hearts', 'Diamonds', 'Clubs', 'Spades'];
        const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
        const deck = [];

        for (let suit of suits) {
            for (let value of values) {
                deck.push(`${value} of ${suit}`);
            }
        }
        return deck;
    }

    drawCard() {
        if (this.cards.length === 0) {
            console.log("No cards left in the deck.");
            return null;
        }

        const randomIndex = Math.floor(Math.random() * this.cards.length);
        const drawnCard = this.cards[randomIndex];

        // Remove the drawn card from the deck and add to used cards
        this.cards.splice(randomIndex, 1);
        this.usedCards.push(drawnCard);

        return drawnCard;
    }

    resetDeck() {
        this.cards = this.createDeck();
        this.usedCards = [];
    }
}

module.exports = Deck;
