import { useEffect, useState } from "react";
import { useLocation } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/core";

// New parent component wrapper  
interface FlashCardDeckProps {  
  cards: Array<[string, string]>; // Data structure for the card deck  
}  

export const FlashCardPage = () => {
  const location = useLocation();
  const {filePath} = location.state || {};
  if (filePath == null) {
    return (<h1>Error</h1>);
  }
  const [cards, setCards] = useState<[string,string][]>([]);
  useEffect(() => {invoke<[string, string][]>('open_card_file', {filePath: filePath}).then((c:[string,string][]) => {
    setCards(c);
  }
  )});
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

  // Get the current card content  
  const currentCard = cards[currentIndex] || ['', ''];  

  return (  
    <div className="deck-container">  
      {/* Card position indicator */}  
      <div className="counter">  
        Card {cards.length > 0 ? currentIndex + 1 : 0} / {cards.length}  
      </div>  

      {/* Use key to force reset child component state */}  
      <FlipCard   
        key={currentIndex}  // Key: Reset internal state via key change  
        front={currentCard[0]}  
        back={currentCard[1]}  
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
  front: string;
  back: string;
}

const FlipCard = ({ front, back }: FlashCardProps) => {
  const [showBack, setShowBack] = useState(false);

  return (
    <div className="flip-card">
      <div 
        className="front-content"
        dangerouslySetInnerHTML={{ __html: front }}
      />
      
      <button 
        onClick={() => setShowBack(!showBack)}
        style={{ margin: '10px 0' }}
      >
        {showBack ? 'Hide Answer' : 'Show Answer'}
      </button>

      {showBack && (
        <div 
          className="back-content"
          dangerouslySetInnerHTML={{ __html: back }}
          style={{ marginTop: '10px', borderTop: '1px solid #ccc', paddingTop: '10px' }}
        />
      )}
    </div>
  );
};
