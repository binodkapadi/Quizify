## OVERVIEW

Quizify is a full-stack web application that automatically generates interactive quizzes from user-provided notes or text content.
It combines AI-powered question generation, a Python and FastAPI backend, and a React, HTML, CSS frontend — all deployed in the Vercel(frontend) and Render(backend).

## DEPLOYMENT LINK:
Deployment Live Link(Frontend =>(Vercel)) : https://binodkapadiquizify.vercel.app/

Deployment Live Link(Backend => (Render)) : https://quizify-binodkapadi.onrender.com

    https://binodkapadiquizify.vercel.app/

    https://quizify-binodkapadi.onrender.com


## PROJECT SETUP

npm = node package manager

npx = node package executer

Step 1: Setup Folder Structure

Open VS Code and create a new folder:

    mkdir QuizGenerator
    cd QuizGenerator

A) Backend Setup (FastAPI + Python)

    mkdir backend
    cd backend
    python -m venv venv
    venv\Scripts\activate 

Install Dependencies

     pip install -r requirements.txt

Add .env file

    GOOGLE_API_KEY=your_gemanai_api_key_here


B) Frontend Setup (React)

     mkdir frontend
     cd frontend
     npx create-react-app .

Install dependencies

     npm install axios


Add .env file

     REACT_APP_API_URL=http://127.0.0.1:8000


For Pdf Creation and download

     npm install jspdf


## -----------------Run Locally----------------------------

In separate terminals:

Backend:

    cd backend
    venv\Scripts\activate
    uvicorn app.main:app --reload

or if you don't make app folder inside the backend folder where main.py file is present the you can simply run backend by using.

     uvicorn main:app --reload

Frontend:

    cd frontend
    npm start


## Pushing code to GitHub repository 

1) Create new repository in GitHub manually (Just Name the GitHub repository) Do not add readme file, gitignore file, liscence fle initially.

===========================Step-by-step guide:=============================

1) Initialize a Git repository

       git init

2) Add your GitHub remote

       git remote add origin https://github.com/<user-name>/repo-name.git

Note: (Replace <username> and <repo-name> with your actual GitHub info.)

3) Set your main branch name

       git branch -M main

4) Add all files for commit

       git add .

5) Commit your changes

        git commit -m "Any comment Write here Do not leave empty"

9) Push your code to GitHub

         git push -u origin main

10) Add Readme file

        git add README.md


## Suppose After Pushing code You have updated code in the vs-code then for again push

1)  Check your current branch

        git branch

3)  Check the status (see changed files)
   
        git status

5) After the first push, next time you only need:

    a) Add all changed files if you have changed multiple files simply use this

           git add .

   OR
   
   => (If you have changed only one file then you want to push only that file at that time give the exact path of your file there)
   
   =>( If inside folder,  Here frontend is just folder name you can replace your folder name)
   =>(use exact path of file which you want to push)

           cd frontend
           git add src/components/Notesinput.js
   
    or
   =>(Exact path of file including folder which you want to push)

        git add frontend/src/components/Notesinput.js  


    b) Commit your changes

            git commit -m "Updated backend logic and frontend UI"

    c) Push your changes to GitHub

             git push origin main

   Note: (Replace main with your branch name if different.) otherwise no need to replace main for beginner


   Note: Once you have made manual changes in your github repository by going into github profile after you pushed code from vscode terminal to github . After that when you update new code into vscode and tries to push this code into same github repository it will show error.

           To https://github.com/binodkapadi/Quizify.git !
           [rejected] main -> main (fetch first)
           error: failed to push some refs to 'https://github.com/binodkapadi/Quizify.git'
        hint: Updates were rejected because the remote contains work that you do hint: not have locally.
        This is usually caused by another repository pushing hint: to the same ref.
        You may want to first integrate the remote changes
        hint: (e.g., 'git pull ...') before pushing again.
        hint: See the 'Note about fast-forwards' in 'git push --help' for details. showing this

The error means your remote branch (main on GitHub) has new commits that your local copy doesn’t yet have.
So Git is refusing to overwrite it.

## Here’s how to fix it safely

Step 1 — Pull the latest changes first

In your project folder, run:

     git pull origin main --rebase


--rebase makes sure your local commits are applied on top of the latest remote commits (cleaner history).
If you get any merge conflicts, Git will tell you — fix them manually, 

then run:

    git add .
    git rebase --continue

Step 2 — Push again

After a successful pull/rebase:

    git push origin main

Now it will push cleanly 

## If you don’t care about remote changes (overwrite completely)

If you’re 100% sure your local version is the one you want to keep:

     git push origin main --force

But, careful — this overwrites the remote history.
