## PROJECT SETUP

npm = node package manager
npx = node package executer

Step 1: Setup Folder Structure

 => Open VS Code and create a new folder:

    mkdir QuizGenerator
    cd QuizGenerator

=> Backend Setup (FastAPI + Python)
    mkdir backend
    cd backend
    python -m venv venv
    venv\Scripts\activate 

=> Install Dependencies
     pip install -r requirements.txt

=> Add .env file
    GOOGLE_API_KEY=your_gemanai_api_key_here


=>  Frontend Setup (React)
     mkdir frontend
     cd frontend
     npx create-react-app .

=> Install dependencies
     npm install axios


=> Add .env file
     REACT_APP_API_URL=http://127.0.0.1:8000

-----------------Run Locally----------------------------

In separate terminals:

Backend:
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload

Frontend:
cd frontend
npm start


## Pushing code to GitHub repository 
1) Create new repository in GitHub manually (Just Name the GitHub repository) Do not add readme file, gitignore file, liscence fle initially.

===========================Step-by-step guide:=============================

1) git init       =>(Initialize a Git repository)

2) git remote add origin https://github.com/<user-name>/repo-name.git     =>(Add your GitHub remote)

    Note: (Replace <username> and <repo-name> with your actual GitHub info.)

3) git branch -M main                =>(Set your main branch name)

4) git add .                         =>(Add all files for commit)

5) git commit -m "Any comment Write here Do not leave empty"             =>(Commit your changes)

6) git push -u origin main                                         =>(Push your code to GitHub)


===================Suppose After Pushing code You have updated code in the vs-code then for again push===========

1)  git branch     =>(Check your current branch)

2)  git status     =>(Check the status (see changed files))

3) After the first push, next time you only need:

    a)  git add .      =>( Add all changed files if you have changed multiple files simply use this)
     
          or
           cd frontend     =>( if inside folder,  Here frontend is just folder name you can replace your folder name)
       
           git add src/components/Notesinput.js    =>(use exact path of file which you want to push )

           or

           git add frontend/src/components/Notesinput.js    =>(Exact path of file including folder which you want to push)


    b) git commit -m "Updated backend logic and frontend UI"  =>(Commit your changes)

    c) git push origin main    =>(Push your changes to GitHub)

       Note: (Replace main with your branch name if different.) otherwise no need to replace main for beginner


      
