use chrono::{Datelike, TimeZone, Utc};
use fancy_regex::Regex;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use std::{fs::File, io::{Read, Write}, path::{Path, PathBuf}};
const DB_DIR: &str = "datas";
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            open_card_file,
            update_card_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub struct ObjectDB {
    path: PathBuf,
}

impl ObjectDB {
    /// Create new object database
    pub fn new(path: &Path) -> std::io::Result<ObjectDB> {
        if !path.exists() {
            std::fs::create_dir(path)?;
        } else if !path.is_dir() {
            return Err(std::io::Error::new(std::io::ErrorKind::AddrInUse, "path is a file"));
        }
        let path_buf = path.to_path_buf();
        Ok(ObjectDB { path: path_buf })
    }

    /// Store object in database
    pub fn store(&self, hash: &Hash, obj: &impl Serialize) -> std::io::Result<()> {
        let (dir_part, file_part) = hash.split_at(2);

        // Build storage path
        let obj_dir = self.path.join(dir_part);
        let obj_path = (&obj_dir).join(file_part);

        if !obj_dir.exists() {
            std::fs::create_dir(&obj_dir)?;
        }

        let tmp_obj_path = obj_dir.join("tmp");
        let mut file = std::fs::File::create(&tmp_obj_path).unwrap();
        let json = json!(obj).to_string();
        file.write_all(&json.into_bytes())?;
        file.flush()?;
        std::fs::rename(tmp_obj_path, obj_path)?;
        Ok(())
    }

    /// Retrieve object from database
    pub fn retrieve<T: DeserializeOwned, E: AsRef<str>>(&self, hash: E) -> std::io::Result<T> {
        // Validate SHA format
        let encoded_sha = &hash.as_ref();
        if encoded_sha.len() != 64 || !encoded_sha.chars().all(|c| c.is_ascii_hexdigit()) {
            return Err(std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "Invalid SHA hash format",
            ));
        }

        // Parse path
        let (dir_part, file_part) = encoded_sha.split_at(2);
        let obj_path = self.path.join(dir_part).join(file_part);

        // Read file
        let mut file = File::open(obj_path)?;
        let mut contents = Vec::new();
        file.read_to_end(&mut contents)?;
        let obj :T = serde_json::from_slice(&contents)?;
        Ok(obj)
    }

    pub fn exists<E: AsRef<str>>(&self, hash: E) -> bool {
        let hash = hash.as_ref();
        let (dir_part, file_part) = hash.split_at(2);

        // Build storage path
        let obj_dir = self.path.join(dir_part);
        let obj_path = (&obj_dir).join(file_part);
        obj_path.exists()
    }
}

#[tauri::command]
fn greet() -> Result<(), String> {
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
struct CardStatus {
    repetitions: i32,
    factor: f64,
    interval: i32,
    due: i64,
}

fn calculate_new_status(prev: CardStatus, quality: u32) -> CardStatus {
    let (reps, interval, factor) = if quality >= 3 {
        // Correct answer: update interval and repetition count
        let new_reps = prev.repetitions + 1;
        let new_interval = match prev.repetitions {
            0 => 1,                        // First review: 1 day
            1 => 6,                        // Second review: 6 days
            _ => (prev.interval as f64 * prev.factor).ceil() as i32, // Subsequent reviews: old interval × factor
        };
        // Calculate new factor
        let q = quality as f64;
        let ease_change = 0.1 - (5.0 - q) * (0.08 + (5.0 - q) * 0.02);
        (new_reps, new_interval, prev.factor + ease_change)
    } else {
        // Incorrect answer: reset repetition count and interval
        (0, 1, prev.factor)
    };

    // Minimum factor is 1.3
    let factor = factor.max(1.3);

    // Calculate new due date (current time + new interval in days)
    let due = prev.due + (interval as i64) * 60 * 60 * 24;

    CardStatus {
        repetitions: reps,
        interval,
        factor,
        due,
    }
}
#[tauri::command]
fn update_card_status(hash: Hash, quality: u32) -> Result<(), String> {
    let obj_db = ObjectDB::new(Path::new(DB_DIR)).map_err(|e|{e.to_string()})?;
    let current_status: CardStatus = obj_db.retrieve(&hash).map_err(|e|{e.to_string()})?;
    // 2. 计算新状态
    let new_status = calculate_new_status(current_status, quality);
    // 3. 更新数据库
    obj_db.store(&hash, &new_status).map_err(|e|{e.to_string()})?;
    Ok(())
}
fn today_timestamp() -> i64 {
    let now = Utc::now();

    let year = now.year();
    let month = now.month();
    let day = now.day();

    let today_midnight = Utc.with_ymd_and_hms(year, month, day, 0, 0, 0).unwrap();

    let timestamp = today_midnight.timestamp();
    timestamp
}

type Hash = String;
#[derive(Serialize)]
struct Card {
    hash: Hash,
    front: String,
    back: String,
}

impl Card {
    fn new<S: AsRef<str>>(front: S, back: S) -> Card {
        let front = front.as_ref();
        let back = back.as_ref();
        let mut hasher = Sha256::new();
        hasher.update(front);
        hasher.update(back);
        let hash = hasher.finalize();
        let hash = hex::encode(hash);
        Card {
            hash: hash,
            front: front.to_owned(),
            back: back.to_owned(),
        }
    }
}

#[tauri::command]
/* Open a card file, returns cards should be reviewed today */
fn open_card_file(file_path: &str) -> Result<Vec<Card>, String> {
    let mut file = File::open(file_path).map_err(|why| why.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|why| why.to_string())?;
    let contents = contents.replace("\r\n", "\n");
    let qas = extract_qa(&contents).map_err(|why| why.to_string())?;
    let cards: Vec<Card> = qas
        .into_iter()
        .map(|qa: (String, String)| Card::new(qa.0, qa.1))
        .collect();
    let cards = insert_and_fetch_db(cards)?;
    Ok(cards)
}

fn insert_and_fetch_db(cards: Vec<Card>) -> Result<Vec<Card>, String> {
    insert_new_cards(&cards).map_err(|_| "Failed to insert cards.".to_string())?;
    let cards = fetch_review_cards(cards)?;
    Ok(cards)
}

fn fetch_review_cards(cards: Vec<Card>) -> Result<Vec<Card>, String> {
    // 若输入卡片为空，直接返回空 Vec
    if cards.is_empty() {
        return Ok(Vec::new());
    }
    let now_timestamp = Utc::now().timestamp();
    let obj_db = ObjectDB::new(Path::new(DB_DIR)).map_err(|e|{e.to_string()})?;

    let result = cards.into_iter().filter(|card|{
        if let Ok(card_status) = obj_db.retrieve::<CardStatus, _>(&card.hash).map_err(|e|{e.to_string()}) {
            card_status.due <= now_timestamp
        } else {
            false
        }
    }).collect();
    Ok(result)
}

fn insert_new_cards(cards: &[Card]) -> Result<(), ()> {
    let rep_init = 0;
    let factor_init = 2.5;
    let interval_init = 0;
    let today_timestamp = today_timestamp();

    let card_status = CardStatus {
        repetitions: rep_init,
        factor: factor_init,
        interval: interval_init,
        due: today_timestamp,
    };
    let obj_db = ObjectDB::new(Path::new(DB_DIR)).map_err(|why|{()})?;
    for card in cards {
        if !obj_db.exists(&card.hash) {
            obj_db.store(&card.hash, &card_status).unwrap();
        }
    }
    Ok(())
}

fn extract_qa(input: &str) -> Result<Vec<(String, String)>, Box<dyn std::error::Error>> {
    // Thanks: https://github.com/ObsidianToAnki/Obsidian_to_Anki/wiki/Question-answer-style
    let re = Regex::new(r"(?m)^Q: ((?:.+\n)*)\n*A: (.+(?:\n(?:^.{1,3}$|^.{4}(?<!<!--).*))*)")?;

    let mut results = Vec::new();
    for capture in re.captures_iter(input) {
        let capture = capture?;
        if let (Some(q), Some(a)) = (capture.get(1), capture.get(2)) {
            results.push((
                q.as_str().trim_end().to_string(),
                a.as_str().trim_end().to_string(),
            ));
        }
    }
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_all() {
        let input = r#"
Q: How do you use this style?
A: Just like this.

Guguga. SHou

Q: cannt see me 

Q: Can the question
run over multiple lines?
A: Yes, and
So can the answer

Q: Does the answer need to be immediately after the question?


A: No, and preceding whitespace will be ignored.

Q: How is this possible?
A: The 'magic' of regular expressions!
        "#;
        for (q, a) in extract_qa(input).unwrap() {
            println!("question:{q}");
            println!("ans:{a}");
        }
    }

    #[test]
    fn test_crlf() {
        let input = "Q: How do you use this style?\r\nA: Just like this.\r\nGuguga. SHou\r\nQ: cannt see me\r\nQ: Can the question
run over multiple lines?\r\n
A: Yes, and\r\n
So can the answer

Q: Does the answer need to be immediately after the question?


A: No, and preceding whitespace will be ignored.

Q: How is this possible?
A: The 'magic' of regular expressions!
        ";
        for (q, a) in extract_qa(input).unwrap() {
            println!("question:{q}");
            println!("ans:{a}");
        }
    }
    #[test]
    fn test_single_line_qa() {
        let input = r#"Q: Question?
A: Answer"#;
        let result = extract_qa(input).unwrap();
        assert_eq!(result, vec![("Question?".into(), "Answer".into())]);
    }

    #[test]
    fn test_multi_line_qa() {
        let input = r#"Q: Line1
Line2?
A: Answer1
Answer2"#;
        let result = extract_qa(input).unwrap();
        assert_eq!(
            result,
            vec![("Line1\nLine2?".into(), "Answer1\nAnswer2".into())]
        );
    }

    #[test]
    fn test_whitespace_between_qa() {
        let input = r#"Q: Question?

A: Answer
"#;
        let result = extract_qa(input).unwrap();
        assert_eq!(result, vec![("Question?".into(), "Answer".into())]);
    }

    #[test]
    fn test_special_characters() {
        let input = r#"Q: What's this?
A: It's 'magic'"#;
        let result = extract_qa(input).unwrap();
        assert_eq!(result, vec![("What's this?".into(), "It's 'magic'".into())]);
    }

    #[test]
    fn test_multiple_qa_pairs() {
        let input = r#"Q: Q1?
A: A1

Q: Q2
has two lines
A: A2
has
three
lines"#;
        let result = extract_qa(input).unwrap();
        assert_eq!(
            result,
            vec![
                ("Q1?".into(), "A1".into()),
                ("Q2\nhas two lines".into(), "A2\nhas\nthree\nlines".into())
            ]
        );
    }
}
