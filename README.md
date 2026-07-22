# Crime Investigation Board (CIB)

![Node.js](https://img.shields.io/badge/Node.js-22.x-green)
![Express](https://img.shields.io/badge/Express.js-Backend-black)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-blue)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748)
![License](https://img.shields.io/badge/License-Educational-orange)

A role-based case investigation and evidence management system built to simplify the complete investigation workflow inside a crime investigation department.

The application allows different officers to work on the same case according to their responsibilities while maintaining a secure chain of custody and complete investigation history.

<img width="1536" height="698" alt="image" src="https://github.com/user-attachments/assets/167f53cd-aa4f-4196-9e0e-b1446b7b348a" />




Features
Secure role-based authentication
FIR Registration
Case Creation & Assignment
Evidence Upload
Digital Evidence Vault
Investigation Timeline
Forensic Request Management
Superintendent Review
Chargesheet Approval
Real-time workflow updates
Audit Logs
Dashboard Analytics
Mobile Responsive UI
User Roles
Super Admin
Manage officers
Create departments
Register FIRs
Create and assign cases
Review investigations
Approve or reject chargesheets
Monitor analytics and audit logs
Sub Inspector
View assigned cases
Upload evidence
Add investigation notes
Send evidence for forensic examination
Forward completed investigation to Superintendent
Forensic Officer
View forensic requests
Analyze submitted evidence
Upload forensic reports
Update forensic status
Superintendent
Review completed investigations
Read timelines and reports
Approve Chargesheet
Reject Investigation
Request Additional Investigation
Close the case after final approval
Investigation Workflow
Register FIR
      ↓
Create Case
      ↓
Assign Sub Inspector
      ↓
Upload Evidence
      ↓
Forensic Examination
      ↓
Investigation Complete
      ↓
Forward to Superintendent
      ↓
Approve Chargesheet
      ↓
Case Closed
Tech Stack
Frontend
HTML
CSS
JavaScript
Backend
Node.js
Express.js
Database
PostgreSQL
Prisma ORM
Other Tools
JWT Authentication
Multer
Cloudinary
Socket.io
Render Deployment
Demo Accounts
Role	Officer ID	Password
Super Admin	SA-001	Admin123!
Sub Inspector	SI-808	Mohit@123
Forensic Officer	FOR-580	Pass@123
Superintendent	SP-973	Pass@123
Running the Project
git clone <repository-url>

cd CIB

npm install

npm run dev
Environment Variables

Create a .env file and configure the required values.

DATABASE_URL=

JWT_SECRET=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=

PORT=5000
Folder Structure
server/
│
├── src
│   ├── controllers
│   ├── middleware
│   ├── routes
│   ├── services
│   ├── utils
│   └── validations
│
├── prisma
│
└── uploads
Highlights
Secure authentication using JWT
Role-based access control
End-to-end investigation workflow
Digital evidence management
Case timeline tracking
Audit logging
Responsive interface
Complete investigation lifecycle from FIR registration to final case closure
Future Improvements
Email notifications
OTP based authentication
PDF Chargesheet generation
Advanced search & filters
Multi-language support


## Developed By

**Mohammad Adil Khan**

B.Tech Computer Science Engineering

Developed during the ReadyNest Summer Internship as a full-stack project demonstrating a complete Crime Investigation Management System with secure role-based access, evidence management, forensic workflow, and end-to-end case lifecycle management.


