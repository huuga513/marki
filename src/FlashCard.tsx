import { useEffect, useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import { invoke } from "@tauri-apps/api/core";
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css' // `rehype-katex` does not import the CSS

interface Card {
  hash: string;
  front: string;
  back: string;
}
// New parent component wrapper  
interface FlashCardDeckProps {
  cards: Array<Card>; // Data structure for the card deck  
}

function NoCardsMessage() {
  const navigate = useNavigate();

  return (
    <div>
      <h2>There are no cards to study today.</h2>
      <button
        onClick={() => navigate('/')}
      >
        Back
      </button>
    </div>
  );
}

export const FlashCardPage = () => {
  const location = useLocation();
  const { dir } = location.state || {};
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true); // New loading state added

  useEffect(() => {
    if (dir) { // Ensure loading only occurs if dir exists
      invoke<Card[]>('open_card_dir', { dir })
        .then((c: Card[]) => {
          setCards(c);
        })
        .finally(() => {
          setIsLoading(false); // Update loading state regardless of success or failure
        });
    }
  }, [dir]); // Add dir as a dependency

  if (dir == null) {
    return <h1>Error</h1>;
  }

  if (isLoading) {
    return <h2>Loading cards...</h2>;
  }

  return <FlashCardDeck cards={cards} />;
}
const FlashCardDeck: React.FC<FlashCardDeckProps> = ({ cards }) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [shouldNext, setShouldNext] = useState<boolean>(false);

  // Handle switching to the next card  
  if (shouldNext) {
    setCurrentIndex(prev => (prev + 1));
    setShouldNext(false);
  };

  if (currentIndex >= cards.length) {
    return (
      <NoCardsMessage />
    );
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
        setShouldNext={setShouldNext}
      />

    </div>
  );
};

interface FlashCardProps {
  card: Card;
  setShouldNext: React.Dispatch<React.SetStateAction<boolean>>
}

const FlipCard = ({ card, setShouldNext }: FlashCardProps) => {
  const [showBack, setShowBack] = useState(false);
  const onRate = (score: number) => {
    invoke('update_card_status', {
      hash: card.hash,
      quality: score,
    });
    setShouldNext(true);
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
      <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
        {card.front}
      </ReactMarkdown>
      {!showBack &&
        <button
          onClick={() => setShowBack(!showBack)}
          style={{ margin: '10px 0' }}
        >
          {showBack ? 'Hide Answer' : 'Show Answer'}
        </button>
      }

      {showBack && (
        <div>
          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
            {card.back}
          </ReactMarkdown>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px',
            marginTop: '10px',
            justifyContent: 'center'
          }}>
            {([0, 1, 2, 3, 4, 5]).map((score: number) => (
              <button
                key={score}
                onClick={() => handleRate(score)}
                style={{
                  padding: '8px 12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                {ratingLabels[score as 5 | 4 | 3 | 2 | 1 | 0]} ({score})
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};