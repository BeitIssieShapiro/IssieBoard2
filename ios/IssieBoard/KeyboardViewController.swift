import UIKit

class KeyboardViewController: UIInputViewController {
    
    var keyboardView: UIView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupKeyboard()
    }
    
    func setupKeyboard() {
        // Create the keyboard view
        keyboardView = UIView(frame: CGRect(x: 0, y: 0, width: 0, height: 300))
        keyboardView.backgroundColor = .systemGray5
        
        // Create a simple button grid
        createSimpleKeyboard()
        
        view.addSubview(keyboardView)
        
        // Setup constraints
        keyboardView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            keyboardView.leftAnchor.constraint(equalTo: view.leftAnchor),
            keyboardView.rightAnchor.constraint(equalTo: view.rightAnchor),
            keyboardView.topAnchor.constraint(equalTo: view.topAnchor),
            keyboardView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            keyboardView.heightAnchor.constraint(equalToConstant: 300)
        ])
    }
    
    func createSimpleKeyboard() {
        let rows = [
            ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
            ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
            ["Z", "X", "C", "V", "B", "N", "M"]
        ]
        
        let buttonHeight: CGFloat = 45
        let buttonSpacing: CGFloat = 6
        let sideMargin: CGFloat = 3
        let topMargin: CGFloat = 10
        
        for (rowIndex, row) in rows.enumerated() {
            let rowView = UIView()
            keyboardView.addSubview(rowView)
            
            rowView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                rowView.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + CGFloat(rowIndex) * (buttonHeight + buttonSpacing)),
                rowView.centerXAnchor.constraint(equalTo: keyboardView.centerXAnchor),
                rowView.heightAnchor.constraint(equalToConstant: buttonHeight)
            ])
            
            let rowWidth = CGFloat(row.count) * (buttonHeight + buttonSpacing) - buttonSpacing
            rowView.widthAnchor.constraint(equalToConstant: rowWidth).isActive = true
            
            for (buttonIndex, letter) in row.enumerated() {
                let button = createKeyButton(letter: letter)
                rowView.addSubview(button)
                
                button.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    button.leftAnchor.constraint(equalTo: rowView.leftAnchor, constant: CGFloat(buttonIndex) * (buttonHeight + buttonSpacing)),
                    button.topAnchor.constraint(equalTo: rowView.topAnchor),
                    button.widthAnchor.constraint(equalToConstant: buttonHeight),
                    button.heightAnchor.constraint(equalToConstant: buttonHeight)
                ])
            }
        }
        
        // Add space bar
        let spaceBar = createKeyButton(letter: "space")
        spaceBar.setTitle("space", for: .normal)
        keyboardView.addSubview(spaceBar)
        
        spaceBar.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            spaceBar.centerXAnchor.constraint(equalTo: keyboardView.centerXAnchor),
            spaceBar.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + 3 * (buttonHeight + buttonSpacing)),
            spaceBar.widthAnchor.constraint(equalToConstant: 200),
            spaceBar.heightAnchor.constraint(equalToConstant: buttonHeight)
        ])
        
        // Add delete button
        let deleteButton = createKeyButton(letter: "⌫")
        keyboardView.addSubview(deleteButton)
        
        deleteButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            deleteButton.rightAnchor.constraint(equalTo: keyboardView.rightAnchor, constant: -sideMargin),
            deleteButton.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + 2 * (buttonHeight + buttonSpacing)),
            deleteButton.widthAnchor.constraint(equalToConstant: 60),
            deleteButton.heightAnchor.constraint(equalToConstant: buttonHeight)
        ])
        
        // Add keyboard switch button
        let nextKeyboardButton = createKeyButton(letter: "🌐")
        keyboardView.addSubview(nextKeyboardButton)
        
        nextKeyboardButton.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            nextKeyboardButton.leftAnchor.constraint(equalTo: keyboardView.leftAnchor, constant: sideMargin),
            nextKeyboardButton.topAnchor.constraint(equalTo: keyboardView.topAnchor, constant: topMargin + 3 * (buttonHeight + buttonSpacing)),
            nextKeyboardButton.widthAnchor.constraint(equalToConstant: 50),
            nextKeyboardButton.heightAnchor.constraint(equalToConstant: buttonHeight)
        ])
    }
    
    func createKeyButton(letter: String) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle(letter, for: .normal)
        button.backgroundColor = .white
        button.setTitleColor(.black, for: .normal)
        button.layer.cornerRadius = 5
        button.layer.shadowColor = UIColor.black.cgColor
        button.layer.shadowOffset = CGSize(width: 0, height: 1)
        button.layer.shadowOpacity = 0.3
        button.layer.shadowRadius = 0
        button.titleLabel?.font = UIFont.systemFont(ofSize: 20, weight: .regular)
        button.addTarget(self, action: #selector(keyPressed(_:)), for: .touchUpInside)
        return button
    }
    
    @objc func keyPressed(_ sender: UIButton) {
        guard let key = sender.title(for: .normal) else { return }
        
        switch key {
        case "⌫":
            textDocumentProxy.deleteBackward()
        case "space":
            textDocumentProxy.insertText(" ")
        case "🌐":
            advanceToNextInputMode()
        default:
            textDocumentProxy.insertText(key.lowercased())
        }
    }
    
    override func textWillChange(_ textInput: UITextInput?) {
        // Called when the text is about to change
    }
    
    override func textDidChange(_ textInput: UITextInput?) {
        // Called when the text has changed
    }
}
