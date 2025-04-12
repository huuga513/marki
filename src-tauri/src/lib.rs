use std::{fs::File, io::Read};

use serde::Serialize;
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .invoke_handler(tauri::generate_handler![open_card_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

use fancy_regex::Regex;

#[derive(Serialize, Default)]
struct CardFile {
    cards: Vec<(String, String)>,
    it: u32
}
#[tauri::command]
fn open_card_file(file_path: &str) -> Result<Vec<(String, String)>, String> {
    let mut file = File::open(file_path).map_err(|why|{
        why.to_string()
    })?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|why|{
        why.to_string()
    })?;
    let contents = contents.replace("\r\n", "\n");
    let qas = extract_qa(&contents).map_err(|why|{
        why.to_string()
    })?;
    Ok(qas)
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
