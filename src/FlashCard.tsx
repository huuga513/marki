import { useEffect, useState } from "react";
import { useLocation } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/core";

interface Card {
  hash: string;
  front: string;
  back: string;
}
// New parent component wrapper  
interface FlashCardDeckProps {  
  cards: Array<Card>; // Data structure for the card deck  
}  

export const FlashCardPage = () => {
  const location = useLocation();
  const {filePath} = location.state || {};
  if (filePath == null) {
    return (<h1>Error</h1>);
  }
  const [cards, setCards] = useState<Card[]>([]);
  useEffect(() => {invoke<Card[]>('open_card_file', {filePath: filePath}).then((c:Card[]) => {
    setCards(c);
  }
  )}, []);
  return (
    <FlashCardDeck cards={cards}/>
  );
}
const FlashCardDeck: React.FC<FlashCardDeckProps> = ({ cards }) => {  
  const [currentIndex, setCurrentIndex] = useState<number>(0);  
  const [localShowBack, setLocalShowBack] = useState(false);  

  // Handle switching to the next card  
  const handleNext = () => {  
    if (cards.length === 0) return;  

    setCurrentIndex(prev => (prev + 1) % cards.length);  
    setLocalShowBack(false); // Force hide the answer when switching  
  };  
  if (cards.length == 0) {
    return (<></>);
  }

  // Get the current card content  
  const currentCard = cards[currentIndex];  

  return (  
    <div className="deck-container">  
      {/* Card position indicator */}  
      <div className="counter">  
        Card {cards.length > 0 ? currentIndex + 1 : 0} / {cards.length}  
      </div>  

      {/* Use key to force reset child component state */}  
      <FlipCard   
        key={currentIndex}  // Key: Reset internal state via key change  
        card={currentCard}
      />  

      {/* Next button */}  
      <button   
        onClick={handleNext}  
        disabled={cards.length <= 1} // Disable for single card  
        className="next-button"  
      >  
        Next →  
      </button>  
    </div>  
  );  
};  

interface FlashCardProps {
  card: Card;
}

const FlipCard = ({card}: FlashCardProps) => {
  const [showBack, setShowBack] = useState(false);
  const onRate = (score: number) => {

  };

  // Shared callback handler for all rating buttons
  const handleRate = (score: number) => {
    // Add any common logic here before calling onRate
    onRate(score);
    // Add any common logic here after calling onRate
  };

  const ratingLabels = {
    5: 'Perfect Response',
    4: 'Correct after Hesitation',
    3: 'Correct with Difficulty',
    2: 'Incorrect; Easy Recall',
    1: 'Incorrect; Correct Remembered',
    0: 'Blackout',
  };

  return (
    <div className="flip-card">
      <div 
        className="front-content"
        dangerouslySetInnerHTML={{ __html: card.front }}
      />
      
      <button 
        onClick={() => setShowBack(!showBack)}
        style={{ margin: '10px 0' }}
      >
        {showBack ? 'Hide Answer' : 'Show Answer'}
      </button>

      {showBack && (
        <div>
          <div 
            className="back-content"
            dangerouslySetInnerHTML={{ __html: card.back }}
            style={{ marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}
          />
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '8px', 
            marginTop: '10px',
            justifyContent: 'center'
          }}>
            {([0, 1, 2, 3, 4, 5]).map((score:number) => (
              <button
                key={score}
                onClick={() => handleRate(score)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {ratingLabels[score as 5|4|3|2|1|0]} ({score})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};