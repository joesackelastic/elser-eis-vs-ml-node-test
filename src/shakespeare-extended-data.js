// Extended Shakespeare dataset with famous quotes and passages
export function generateExtendedShakespeareData(count = 1000) {
  const quotes = [
    // Hamlet
    { play: "Hamlet", speaker: "HAMLET", text: "To be, or not to be, that is the question: Whether 'tis nobler in the mind to suffer the slings and arrows of outrageous fortune, or to take arms against a sea of troubles." },
    { play: "Hamlet", speaker: "POLONIUS", text: "This above all: to thine own self be true, and it must follow, as the night the day, thou canst not then be false to any man." },
    { play: "Hamlet", speaker: "HAMLET", text: "There are more things in heaven and earth, Horatio, than are dreamt of in your philosophy." },
    { play: "Hamlet", speaker: "QUEEN GERTRUDE", text: "The lady doth protest too much, methinks." },
    { play: "Hamlet", speaker: "HAMLET", text: "Though this be madness, yet there is method in 't." },
    { play: "Hamlet", speaker: "HAMLET", text: "What a piece of work is man! How noble in reason! How infinite in faculty!" },
    { play: "Hamlet", speaker: "HAMLET", text: "Alas, poor Yorick! I knew him, Horatio: a fellow of infinite jest, of most excellent fancy." },
    { play: "Hamlet", speaker: "HAMLET", text: "The rest is silence." },
    { play: "Hamlet", speaker: "HAMLET", text: "Get thee to a nunnery, why wouldst thou be a breeder of sinners?" },
    { play: "Hamlet", speaker: "HAMLET", text: "Frailty, thy name is woman!" },
    
    // Romeo and Juliet
    { play: "Romeo and Juliet", speaker: "JULIET", text: "O Romeo, Romeo! wherefore art thou Romeo? Deny thy father and refuse thy name; or, if thou wilt not, be but sworn my love, and I'll no longer be a Capulet." },
    { play: "Romeo and Juliet", speaker: "JULIET", text: "What's in a name? That which we call a rose by any other name would smell as sweet." },
    { play: "Romeo and Juliet", speaker: "ROMEO", text: "But, soft! what light through yonder window breaks? It is the east, and Juliet is the sun." },
    { play: "Romeo and Juliet", speaker: "JULIET", text: "Good night, good night! Parting is such sweet sorrow, that I shall say good night till it be morrow." },
    { play: "Romeo and Juliet", speaker: "MERCUTIO", text: "A plague o' both your houses!" },
    { play: "Romeo and Juliet", speaker: "ROMEO", text: "O, I am fortune's fool!" },
    { play: "Romeo and Juliet", speaker: "JULIET", text: "My bounty is as boundless as the sea, my love as deep; the more I give to thee, the more I have, for both are infinite." },
    { play: "Romeo and Juliet", speaker: "FRIAR LAURENCE", text: "These violent delights have violent ends." },
    { play: "Romeo and Juliet", speaker: "ROMEO", text: "Thus with a kiss I die." },
    { play: "Romeo and Juliet", speaker: "PRINCE", text: "For never was a story of more woe than this of Juliet and her Romeo." },
    
    // Macbeth
    { play: "Macbeth", speaker: "WITCHES", text: "Double, double toil and trouble; Fire burn, and cauldron bubble." },
    { play: "Macbeth", speaker: "MACBETH", text: "Is this a dagger which I see before me, the handle toward my hand? Come, let me clutch thee." },
    { play: "Macbeth", speaker: "LADY MACBETH", text: "Out, damned spot! out, I say!" },
    { play: "Macbeth", speaker: "MACBETH", text: "Tomorrow, and tomorrow, and tomorrow, creeps in this petty pace from day to day to the last syllable of recorded time." },
    { play: "Macbeth", speaker: "WITCHES", text: "Fair is foul, and foul is fair: Hover through the fog and filthy air." },
    { play: "Macbeth", speaker: "MACBETH", text: "Life's but a walking shadow, a poor player that struts and frets his hour upon the stage and then is heard no more." },
    { play: "Macbeth", speaker: "LADY MACBETH", text: "Look like the innocent flower, but be the serpent under't." },
    { play: "Macbeth", speaker: "MACBETH", text: "I have no spur to prick the sides of my intent, but only vaulting ambition." },
    { play: "Macbeth", speaker: "BANQUO", text: "The instruments of darkness tell us truths, win us with honest trifles, to betray's in deepest consequence." },
    { play: "Macbeth", speaker: "MACBETH", text: "Stars, hide your fires; Let not light see my black and deep desires." },
    
    // A Midsummer Night's Dream
    { play: "A Midsummer Night's Dream", speaker: "PUCK", text: "Lord, what fools these mortals be!" },
    { play: "A Midsummer Night's Dream", speaker: "HELENA", text: "Love looks not with the eyes, but with the mind, and therefore is winged Cupid painted blind." },
    { play: "A Midsummer Night's Dream", speaker: "THESEUS", text: "The course of true love never did run smooth." },
    { play: "A Midsummer Night's Dream", speaker: "BOTTOM", text: "I have had a most rare vision. I have had a dream, past the wit of man to say what dream it was." },
    { play: "A Midsummer Night's Dream", speaker: "PUCK", text: "And though she be but little, she is fierce." },
    { play: "A Midsummer Night's Dream", speaker: "OBERON", text: "Ill met by moonlight, proud Titania." },
    { play: "A Midsummer Night's Dream", speaker: "TITANIA", text: "These are the forgeries of jealousy." },
    { play: "A Midsummer Night's Dream", speaker: "LYSANDER", text: "The course of true love never did run smooth." },
    
    // Othello
    { play: "Othello", speaker: "IAGO", text: "O, beware, my lord, of jealousy; It is the green-eyed monster which doth mock the meat it feeds on." },
    { play: "Othello", speaker: "OTHELLO", text: "Put out the light, and then put out the light." },
    { play: "Othello", speaker: "DESDEMONA", text: "I kissed thee ere I killed thee: no way but this, killing myself, to die upon a kiss." },
    { play: "Othello", speaker: "IAGO", text: "I am not what I am." },
    { play: "Othello", speaker: "OTHELLO", text: "O, now, for ever farewell the tranquil mind! Farewell content!" },
    { play: "Othello", speaker: "EMILIA", text: "O, the more angel she, and you the blacker devil!" },
    { play: "Othello", speaker: "OTHELLO", text: "Speak of me as I am; nothing extenuate, nor set down aught in malice." },
    
    // King Lear
    { play: "King Lear", speaker: "LEAR", text: "How sharper than a serpent's tooth it is to have a thankless child!" },
    { play: "King Lear", speaker: "GLOUCESTER", text: "As flies to wanton boys are we to the gods; They kill us for their sport." },
    { play: "King Lear", speaker: "FOOL", text: "Lord, what fools these mortals be!" },
    { play: "King Lear", speaker: "LEAR", text: "Nothing will come of nothing." },
    { play: "King Lear", speaker: "EDGAR", text: "The worst is not so long as we can say 'This is the worst.'" },
    { play: "King Lear", speaker: "CORDELIA", text: "Unhappy that I am, I cannot heave my heart into my mouth." },
    
    // The Tempest
    { play: "The Tempest", speaker: "PROSPERO", text: "We are such stuff as dreams are made on, and our little life is rounded with a sleep." },
    { play: "The Tempest", speaker: "ARIEL", text: "Full fathom five thy father lies; Of his bones are coral made; Those are pearls that were his eyes." },
    { play: "The Tempest", speaker: "CALIBAN", text: "Be not afeard; the isle is full of noises, sounds and sweet airs, that give delight and hurt not." },
    { play: "The Tempest", speaker: "MIRANDA", text: "O brave new world, that has such people in't!" },
    { play: "The Tempest", speaker: "PROSPERO", text: "Hell is empty and all the devils are here." },
    
    // Julius Caesar
    { play: "Julius Caesar", speaker: "SOOTHSAYER", text: "Beware the ides of March." },
    { play: "Julius Caesar", speaker: "ANTONY", text: "Friends, Romans, countrymen, lend me your ears; I come to bury Caesar, not to praise him." },
    { play: "Julius Caesar", speaker: "CAESAR", text: "Et tu, Brute? Then fall, Caesar!" },
    { play: "Julius Caesar", speaker: "BRUTUS", text: "Not that I loved Caesar less, but that I loved Rome more." },
    { play: "Julius Caesar", speaker: "CASSIUS", text: "The fault, dear Brutus, is not in our stars, but in ourselves, that we are underlings." },
    { play: "Julius Caesar", speaker: "CAESAR", text: "Cowards die many times before their deaths; The valiant never taste of death but once." },
    
    // As You Like It
    { play: "As You Like It", speaker: "JAQUES", text: "All the world's a stage, and all the men and women merely players." },
    { play: "As You Like It", speaker: "ROSALIND", text: "Do you not know I am a woman? When I think, I must speak." },
    { play: "As You Like It", speaker: "ORLANDO", text: "O, how bitter a thing it is to look into happiness through another man's eyes!" },
    { play: "As You Like It", speaker: "TOUCHSTONE", text: "The fool doth think he is wise, but the wise man knows himself to be a fool." },
    
    // Twelfth Night
    { play: "Twelfth Night", speaker: "DUKE ORSINO", text: "If music be the food of love, play on; Give me excess of it." },
    { play: "Twelfth Night", speaker: "MALVOLIO", text: "Some are born great, some achieve greatness, and some have greatness thrust upon them." },
    { play: "Twelfth Night", speaker: "FESTE", text: "Better a witty fool than a foolish wit." },
    { play: "Twelfth Night", speaker: "VIOLA", text: "I am all the daughters of my father's house, and all the brothers too." },
    
    // The Merchant of Venice
    { play: "The Merchant of Venice", speaker: "SHYLOCK", text: "If you prick us, do we not bleed? If you tickle us, do we not laugh? If you poison us, do we not die?" },
    { play: "The Merchant of Venice", speaker: "PORTIA", text: "The quality of mercy is not strained; It droppeth as the gentle rain from heaven upon the place beneath." },
    { play: "The Merchant of Venice", speaker: "ANTONIO", text: "All that glisters is not gold." },
    { play: "The Merchant of Venice", speaker: "BASSANIO", text: "The world is still deceived with ornament." },
    
    // Much Ado About Nothing
    { play: "Much Ado About Nothing", speaker: "BENEDICK", text: "When I said I would die a bachelor, I did not think I should live till I were married." },
    { play: "Much Ado About Nothing", speaker: "BEATRICE", text: "I had rather hear my dog bark at a crow than a man swear he loves me." },
    { play: "Much Ado About Nothing", speaker: "BENEDICK", text: "Sigh no more, ladies, sigh no more, men were deceivers ever." },
    
    // Richard III
    { play: "Richard III", speaker: "GLOUCESTER", text: "Now is the winter of our discontent made glorious summer by this sun of York." },
    { play: "Richard III", speaker: "GLOUCESTER", text: "A horse! a horse! my kingdom for a horse!" },
    { play: "Richard III", speaker: "GLOUCESTER", text: "Conscience is but a word that cowards use, devised at first to keep the strong in awe." },
    
    // Henry V
    { play: "Henry V", speaker: "KING HENRY V", text: "Once more unto the breach, dear friends, once more; Or close the wall up with our English dead." },
    { play: "Henry V", speaker: "KING HENRY V", text: "We few, we happy few, we band of brothers." },
    { play: "Henry V", speaker: "KING HENRY V", text: "The game's afoot: Follow your spirit, and upon this charge cry 'God for Harry, England, and Saint George!'" },
    
    // The Taming of the Shrew
    { play: "The Taming of the Shrew", speaker: "KATHERINA", text: "My tongue will tell the anger of my heart, or else my heart concealing it will break." },
    { play: "The Taming of the Shrew", speaker: "PETRUCHIO", text: "Kiss me, Kate, we will be married o'Sunday." },
    
    // Measure for Measure
    { play: "Measure for Measure", speaker: "ISABELLA", text: "O, it is excellent to have a giant's strength, but it is tyrannous to use it like a giant." },
    { play: "Measure for Measure", speaker: "DUKE", text: "The tempter or the tempted, who sins most?" },
    
    // The Winter's Tale
    { play: "The Winter's Tale", speaker: "ANTIGONUS", text: "Exit, pursued by a bear." },
    { play: "The Winter's Tale", speaker: "PERDITA", text: "A wild dedication of yourselves to unpath'd waters, undream'd shores." }
  ];

  // Generate documents by cycling through quotes and adding variations
  const documents = [];
  let id = 1000; // Start from 1000 to avoid conflicts with existing data
  
  while (documents.length < count) {
    for (const quote of quotes) {
      if (documents.length >= count) break;
      
      // Add original quote
      documents.push({
        line_id: id++,
        play_name: quote.play,
        speech_number: Math.floor(Math.random() * 100) + 1,
        line_number: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 200) + 1}`,
        speaker: quote.speaker,
        text_entry: quote.text
      });
      
      if (documents.length >= count) break;
      
      // Add a variation with context
      const contexts = [
        `In the play ${quote.play}, ${quote.speaker} says: ${quote.text}`,
        `${quote.speaker} speaks these words: ${quote.text} This occurs in ${quote.play}.`,
        `From ${quote.play}: "${quote.text}" - ${quote.speaker}`,
        `The character ${quote.speaker} in ${quote.play} declares: ${quote.text}`,
        `These famous words are spoken by ${quote.speaker}: ${quote.text}`
      ];
      
      documents.push({
        line_id: id++,
        play_name: quote.play,
        speech_number: Math.floor(Math.random() * 100) + 1,
        line_number: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 200) + 1}`,
        speaker: quote.speaker,
        text_entry: contexts[Math.floor(Math.random() * contexts.length)]
      });
    }
  }
  
  return documents.slice(0, count);
}